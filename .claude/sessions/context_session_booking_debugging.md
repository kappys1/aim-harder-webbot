# Análisis del Problema de Reservas Intermitentes

## Fecha
2025-10-13

## Problema Reportado
Las reservas automáticas funcionan algunas veces correctamente y otras no. El usuario no puede determinar el error exacto porque los reintentos ocultan la causa raíz del problema.

## Análisis de la Arquitectura Actual

### 1. Flujo de Reserva Automática (Prebooking)

#### Componentes Principales:
1. **QStash Scheduler** - Programa la ejecución 3 segundos antes del momento exacto
2. **Execute Prebooking Webhook** (`/api/execute-prebooking/route.ts`) - Ejecuta la reserva
3. **Booking Service** (`booking.service.ts`) - Comunica con AimHarder API
4. **Booking Business** (`booking.business.ts`) - Contiene lógica de reintentos

### 2. Puntos de Fallo Identificados

#### A. Reintentos en Múltiples Capas (PROBLEMA CRÍTICO)

**Capa 1: BookingBusiness (booking.business.ts:64-93)**
```typescript
// Reintenta hasta 3 veces con delay incremental
for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
  try {
    const response = await this.bookingService.getBookings(params, cookies);
    // ...
  } catch (error) {
    if (error instanceof BookingApiError) {
      if (!error.isRetryable || attempt === this.config.retryAttempts) {
        throw error;
      }
      await this.delay(this.config.retryDelay * attempt);
    }
  }
}
```

**Configuración por defecto:**
- `retryAttempts: 3`
- `retryDelay: 1000ms`
- Total: 1s + 2s + 3s = 6 segundos de espera en caso de fallos

**Capa 2: BookingService (booking.service.ts:30)**
```typescript
// Timeout de 8 segundos por request
this.timeout = config.timeout || 8000;
```

**PROBLEMA:** Los reintentos ocultan errores importantes:
1. **Session Expired**: Si la sesión expira, reintenta 3 veces inútilmente
2. **Network Errors**: Suma 3x8s = 24 segundos antes de fallar
3. **Rate Limiting**: Si AimHarder está limitando, seguimos golpeando la API
4. **Errores de Validación**: Se reintentan cuando no deberían

#### B. Logging Insuficiente

**Problemas actuales:**
1. Los logs de error solo aparecen después de todos los reintentos
2. No se registra qué intento falló y por qué
3. Los errores intermedios se pierden
4. No hay tracking de latencias por intento

**Ejemplo del código actual:**
```typescript
// prebooking-scheduler.business.ts:194-207
catch (error) {
  console.error(`Error executing prebooking ${prebooking.id}:`, error);
  await preBookingService.markFailed(
    prebooking.id,
    error instanceof Error ? error.message : 'Execution error'
  );
}
```

Solo se registra el error final, no los errores intermedios de los reintentos.

#### C. Timeout Inadecuado para Ejecución Crítica

**Problema de Timing:**
- QStash dispara a las 19:29:57
- Objetivo: disparar a las 19:30:00 (3s wait)
- Booking API tiene timeout de 8s
- Con 3 reintentos: hasta 24s de espera
- **RESULTADO:** Podemos disparar a las 19:30:21, 21 segundos tarde

#### D. Falta de Diferenciación de Errores

**Errores que NO deberían reintentar:**
- `bookState: -8` (max bookings reached)
- `bookState: -12` con "ya tienes una reserva" (already booked manually)
- `bookState: 1` (success, pero con warning message)
- HTTP 401/403 (authentication error)
- Validation errors (malformed request)

**Errores que SÍ deberían reintentar:**
- Network timeouts
- HTTP 5xx (server errors)
- Temporary connection issues

**Código actual no diferencia:**
```typescript
// booking.service.ts:328-334
get isRetryable(): boolean {
  return (
    this.type === "TIMEOUT_ERROR" ||
    this.type === "NETWORK_ERROR" ||
    (this.type === "HTTP_ERROR" && this.statusCode >= 500)
  );
}
```

Solo mira el tipo de error HTTP, no el `bookState` de AimHarder.

### 3. Escenarios de Fallo Oculto

#### Escenario 1: Session Expirada
```
Intento 1 (19:30:00): HTTP 401 → Espera 1s
Intento 2 (19:30:01): HTTP 401 → Espera 2s
Intento 3 (19:30:03): HTTP 401 → Falla
```
**Resultado:** 3 segundos perdidos, reserva fallida, no se sabe hasta el final que era la sesión.

#### Escenario 2: Ya Reservado Manualmente
```
Intento 1 (19:30:00): bookState=-12 "ya tienes reserva" → Reintenta (¿por qué?)
Intento 2 (19:30:01): bookState=-12 "ya tienes reserva" → Reintenta
Intento 3 (19:30:02): bookState=-12 "ya tienes reserva" → Marca como "completed"
```
**Resultado:** 2 reintentos innecesarios, confusión en logs.

#### Escenario 3: Timeout de Red
```
Intento 1 (19:30:00): Timeout 8s → Falla a 19:30:08
Intento 2 (19:30:09): Timeout 8s → Falla a 19:30:17
Intento 3 (19:30:18): Timeout 8s → Falla a 19:30:26
```
**Resultado:** 26 segundos después, la reserva ya no tiene sentido.

### 4. Problemas en el Mapper

El mapper detecta correctamente el caso "already booked manually":
```typescript
// booking.mapper.ts:154-162
if (isEarlyBookingError && this.isAlreadyBookedManually(response.errorMssg)) {
  return {
    success: true, // Correcto: trata como éxito
    error: 'already_booked_manually',
    errorMessage: response.errorMssg,
    canRetryLater: false,
    alreadyBookedManually: true,
  };
}
```

**PERO:** Este mapper solo se ejecuta en el webhook final, no durante los reintentos del BookingBusiness.

## Causas Raíz del Problema

1. **Reintentos sin contexto**: El BookingBusiness reintenta sin saber qué tipo de error es
2. **Logging tardío**: Solo vemos el error final, no los intermedios
3. **Timeout excesivo**: 8s por intento es demasiado para reservas críticas de tiempo
4. **Falta de circuit breaker**: Si la API de AimHarder está caída, seguimos golpeándola
5. **No hay tracking estructurado**: Imposible debuggear qué pasó exactamente

## Impacto en Producción

- ⚠️ **Reservas tardías**: Pueden llegar 20+ segundos tarde
- ⚠️ **Recursos desperdiciados**: Reintentos innecesarios
- ⚠️ **Debugging imposible**: No sabemos qué pasó realmente
- ⚠️ **Falsos positivos**: Éxitos que parecen fallos
- ⚠️ **Falsos negativos**: Fallos que parecen timeouts

## Recomendaciones

### Prioridad Alta (Implementar Ya)

#### 1. Logging Estructurado Detallado
```typescript
interface BookingAttemptLog {
  attemptNumber: number;
  startTime: number;
  endTime: number;
  duration: number;
  errorType?: string;
  errorMessage?: string;
  bookState?: number;
  httpStatus?: number;
  isRetryable: boolean;
  willRetry: boolean;
}
```

#### 2. Eliminar Reintentos en BookingBusiness para Createbooking
El webhook ya maneja la lógica correctamente. Los reintentos en BusinessLogic solo aplican para `getBookings`, NO para `createBooking`.

#### 3. Timeout Reducido
- Reducir de 8s a 3s para ejecuciones críticas de prebooking
- Mantener 8s para operaciones de UI interactivas

#### 4. Early Exit en Errores No-Retryables
```typescript
// Detectar inmediatamente:
if (bookState === -8 || bookState === -12 || bookState === 1) {
  // No reintentar, procesar resultado inmediatamente
}
```

#### 5. Structured Logging Service
```typescript
class BookingExecutionLogger {
  logAttempt(attempt: BookingAttemptLog): void
  logSuccess(result: SuccessLog): void
  logFailure(result: FailureLog): void
  getExecutionSummary(): ExecutionSummary
}
```

### Prioridad Media

#### 6. Circuit Breaker Pattern
Si AimHarder falla 3 veces seguidas, pausar 30 segundos antes de más intentos.

#### 7. Metrics & Monitoring
- Success rate por día/hora
- Latencia promedio
- Tipos de error más comunes
- Rate de reintentos

#### 8. Dead Letter Queue
Reservas que fallan después de todos los reintentos → DLQ para investigación manual.

### Prioridad Baja

#### 9. Alerting
Notificar cuando:
- Success rate < 90%
- Latencia > 5s promedio
- Muchos errores de sesión

#### 10. Dashboard
Panel en tiempo real con estado de reservas.

## Próximos Pasos Inmediatos

1. ✅ Crear este documento de análisis
2. ⏭️ Implementar logging estructurado detallado
3. ⏭️ Revisar y ajustar lógica de reintentos
4. ⏭️ Agregar early exit para errores no-retryables
5. ⏭️ Crear servicio de logging con persistencia en Supabase
6. ⏭️ Agregar endpoint de debugging para ver logs de ejecución

## Notas Adicionales

- El código actual de `execute-prebooking/route.ts` es bueno, hace logging detallado
- El problema está en las capas inferiores (BookingBusiness, BookingService)
- La detección de "already booked manually" funciona correctamente
- El scheduler FIFO con 50ms stagger es correcto
