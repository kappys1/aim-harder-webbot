# Análisis: Manejo del Estado de Reserva -12 "Ya Reservado Manualmente"

## Contexto

Cuando QStash ejecuta una prereserva automática y recibe un `bookState: -12` con el mensaje **"No puedes hacer más de una reserva a la misma hora"**, esto indica que el usuario ya ha reservado manualmente la clase desde la aplicación original de AimHarder.

## Problema Actual

### Estado Actual del Código

#### 1. Constante de Estado ([booking.constants.ts:56](modules/booking/constants/booking.constants.ts#L56))
```typescript
BOOKING_STATES: {
  AVAILABLE: 0,
  BOOKED: 1,
  CANCELLED: 1,
  ERROR_MAX_BOOKINGS: -8,
  ERROR_EARLY_BOOKING: -12,  // ⚠️ Mismo código para dos casos diferentes
}
```

**Problema**: La constante `ERROR_EARLY_BOOKING: -12` está documentada para el caso de "reserva demasiado temprana" (cuando intentas reservar con más días de antelación de los permitidos), pero **el mismo código -12 también se usa para "ya reservado a la misma hora"**.

#### 2. Lógica de Éxito en QStash Webhook ([execute-prebooking/route.ts:217](app/api/execute-prebooking/route.ts#L217))
```typescript
const success = bookingResponse.bookState === 1 || bookingResponse.id;
```

**Problema**: Solo se considera éxito cuando `bookState === 1` o hay un `bookingId`. Cuando `bookState === -12`, se marca como fallida, **independientemente del mensaje de error**.

#### 3. Procesamiento en el Mapper ([booking.mapper.ts:142-161](modules/booking/api/mappers/booking.mapper.ts#L142-L161))
```typescript
if (isEarlyBookingError) {
  const availableFrom = this.extractAvailabilityDate(response.errorMssg);
  return {
    success: false,
    error: 'early_booking',
    errorMessage: response.errorMssg,
    canRetryLater: true,  // ⚠️ Siempre true para -12
    availableFrom,
  };
}
```

**Problema**: El mapper trata todos los errores `-12` como "early_booking" recuperable, cuando en realidad **"No puedes hacer más de una reserva a la misma hora" debería considerarse un éxito** (el objetivo se cumplió, solo que manualmente).

#### 4. Extracción de Fecha ([booking.mapper.ts:181-194](modules/booking/api/mappers/booking.mapper.ts#L181-L194))
```typescript
private static extractAvailabilityDate(errorMessage?: string): Date | undefined {
  // Solo busca el patrón "X días de antelación"
  const daysMatch = errorMessage.match(/(\d+)\s+días?\s+de\s+antelación/);
  // ...
}
```

**Problema**: Solo extrae fechas para mensajes de "días de antelación", no maneja otros tipos de mensajes con `-12`.

## Análisis de Casos de Uso del BookState -12

### Caso 1: Reserva Demasiado Temprana (Actual)
**Mensaje**: `"No puedes reservar clases con más de X días de antelación"`

**Comportamiento Esperado**:
- ✅ Estado: `failed`
- ✅ Acción: Crear prereserva automática
- ✅ Retry: Sí (cuando llegue la fecha permitida)

### Caso 2: Ya Reservado Manualmente (NUEVO - No Manejado)
**Mensaje**: `"No puedes hacer más de una reserva a la misma hora"`

**Comportamiento Esperado**:
- ❌ Estado: Actualmente `failed` → **Debería ser `completed`**
- ❌ Acción: Actualmente nada → **Debería cancelar prereserva**
- ❌ Retry: Actualmente no intenta nada más → **Correcto, no hay que hacer nada**

**Razón**: Si el usuario ya reservó manualmente, el objetivo de la prereserva se cumplió. No tiene sentido marcarla como fallida porque **la clase ya está reservada**.

## Impacto

### Impacto en la UX
1. **Estado Confuso**: El usuario ve su prereserva como "failed" cuando en realidad la clase está reservada
2. **Notificaciones Incorrectas**: Se podría notificar un fallo cuando no lo hay
3. **Duplicación de Prerreservas**: El usuario podría intentar crear otra prereserva pensando que falló

### Impacto en los Datos
1. **Métricas Incorrectas**: Las tasas de éxito de prereservas están subestimadas
2. **Logs Engañosos**: Los logs muestran fallos que no son realmente fallos
3. **Debugging Difícil**: Es difícil distinguir entre fallos reales y "fallos exitosos"

## Recomendaciones

### Opción 1: Manejo Específico por Mensaje (RECOMENDADA)

**Ventajas**:
- ✅ No requiere cambios en la API de AimHarder
- ✅ Diferencia claramente entre los dos casos
- ✅ Mantiene compatibilidad con el código existente

**Implementación**:

#### 1. Actualizar el Mapper ([booking.mapper.ts](modules/booking/api/mappers/booking.mapper.ts))
```typescript
static mapBookingCreateResult(response: BookingCreateResponse): {
  success: boolean;
  bookingId?: string;
  error?: string;
  errorMessage?: string;
  canRetryLater?: boolean;
  availableFrom?: Date;
  maxBookings?: number;
  alreadyBookedManually?: boolean; // NUEVO
} {
  const isSuccess = response.bookState === BOOKING_CONSTANTS.BOOKING_STATES.BOOKED;
  const isEarlyBookingError = response.bookState === BOOKING_CONSTANTS.BOOKING_STATES.ERROR_EARLY_BOOKING;
  const isMaxBookingsError = response.bookState === BOOKING_CONSTANTS.BOOKING_STATES.ERROR_MAX_BOOKINGS;

  if (isSuccess) {
    return {
      success: true,
      bookingId: response.id,
    };
  }

  // NUEVO: Detectar reserva manual previa
  if (isEarlyBookingError && this.isAlreadyBookedManually(response.errorMssg)) {
    return {
      success: true, // ✅ Cambio clave: marcar como éxito
      error: 'already_booked_manually',
      errorMessage: response.errorMssg,
      canRetryLater: false,
      alreadyBookedManually: true,
    };
  }

  if (isEarlyBookingError) {
    const availableFrom = this.extractAvailabilityDate(response.errorMssg);
    return {
      success: false,
      error: 'early_booking',
      errorMessage: response.errorMssg,
      canRetryLater: true,
      availableFrom,
    };
  }

  // ... resto del código
}

// NUEVO: Método de detección
private static isAlreadyBookedManually(errorMessage?: string): boolean {
  if (!errorMessage) return false;

  // Patrones que indican reserva manual previa
  const patterns = [
    /no\s+puedes\s+hacer\s+más\s+de\s+una\s+reserva\s+a\s+la\s+misma\s+hora/i,
    /ya\s+tienes\s+una\s+reserva\s+a\s+esa\s+hora/i,
    // Agregar más patrones si AimHarder usa diferentes mensajes
  ];

  return patterns.some(pattern => pattern.test(errorMessage));
}
```

#### 2. Actualizar el Webhook de QStash ([execute-prebooking/route.ts](app/api/execute-prebooking/route.ts))
```typescript
// PHASE 5: UPDATE STATUS (BACKGROUND)
const mappedResult = BookingMapper.mapBookingCreateResult(bookingResponse);
const success = mappedResult.success; // Usar el resultado mapeado

if (success) {
  const message = mappedResult.alreadyBookedManually
    ? 'Booking already created manually by user'
    : bookingResponse.errorMssg || 'Booking created successfully';

  preBookingService
    .markCompleted(prebookingId, {
      bookingId: bookingResponse.id,
      bookState: bookingResponse.bookState,
      message,
    })
    .catch((err) =>
      setImmediate(() =>
        console.error(
          `[HYBRID ${executionId}] Background update failed:`,
          err
        )
      )
    );
  // ...
}
```

#### 3. Actualizar PreBooking Service ([prebooking.service.ts](modules/prebooking/api/services/prebooking.service.ts))
```typescript
/**
 * Mark prebooking as completed with full result
 * @param alreadyBookedManually - Indicates if user booked manually before auto-booking
 */
async markCompleted(
  id: string,
  result: {
    bookingId?: string;
    bookState?: number;
    message?: string;
    alreadyBookedManually?: boolean; // NUEVO
  }
): Promise<void> {
  const executedAt = new Date();
  const { error } = await this.supabase
    .from("prebookings")
    .update({
      status: "completed",
      executed_at: executedAt.toISOString(),
      result: {
        success: true,
        bookingId: result.bookingId,
        bookState: result.bookState,
        message: result.message,
        alreadyBookedManually: result.alreadyBookedManually, // NUEVO
        executedAt: executedAt.toISOString(),
      },
    })
    .eq("id", id);

  if (error) {
    console.error("[PreBookingService] Error marking completed:", error);
    throw new Error(`Failed to mark completed: ${error.message}`);
  }
}
```

#### 4. Actualizar Constantes ([booking.constants.ts](modules/booking/constants/booking.constants.ts))
```typescript
BOOKING_STATES: {
  AVAILABLE: 0,
  BOOKED: 1,
  CANCELLED: 1,
  ERROR_MAX_BOOKINGS: -8,
  ERROR_EARLY_BOOKING: -12, // Usado para múltiples casos:
                             // 1. "No puedes reservar con más de X días"
                             // 2. "No puedes hacer más de una reserva a la misma hora"
},
```

#### 5. Actualizar Tests

**Test en booking.mapper.test.ts**:
```typescript
describe('already booked manually detection', () => {
  it('should treat "already booked at same time" as success', () => {
    const response: BookingCreateResponse = {
      clasesContratadas: '10',
      bookState: -12,
      errorMssg: 'No puedes hacer más de una reserva a la misma hora',
    };

    const result = BookingMapper.mapBookingCreateResult(response);

    expect(result).toMatchObject({
      success: true, // ✅ Éxito, no fallo
      error: 'already_booked_manually',
      errorMessage: response.errorMssg,
      canRetryLater: false,
      alreadyBookedManually: true,
    });
  });

  it('should still treat "too many days in advance" as failure', () => {
    const response: BookingCreateResponse = {
      clasesContratadas: '10',
      bookState: -12,
      errorMssg: 'No puedes reservar clases con más de 4 días de antelación',
    };

    const result = BookingMapper.mapBookingCreateResult(response);

    expect(result).toMatchObject({
      success: false, // ❌ Fallo real
      error: 'early_booking',
      canRetryLater: true,
      alreadyBookedManually: undefined,
    });
  });
});
```

### Opción 2: Crear Nueva Constante (NO RECOMENDADA)

**Desventajas**:
- ❌ Requeriría cambios en la API de AimHarder (fuera de nuestro control)
- ❌ Código legacy podría romperse
- ❌ No es escalable si AimHarder agrega más casos para -12

## Archivos Afectados

### Archivos a Modificar
1. [modules/booking/api/mappers/booking.mapper.ts](modules/booking/api/mappers/booking.mapper.ts) - Agregar lógica de detección
2. [app/api/execute-prebooking/route.ts](app/api/execute-prebooking/route.ts) - Usar resultado mapeado
3. [modules/prebooking/api/services/prebooking.service.ts](modules/prebooking/api/services/prebooking.service.ts) - Agregar campo
4. [modules/booking/constants/booking.constants.ts](modules/booking/constants/booking.constants.ts) - Actualizar documentación

### Archivos de Test a Actualizar
1. [modules/booking/api/mappers/booking.mapper.test.ts](modules/booking/api/mappers/booking.mapper.test.ts)
2. [modules/prebooking/api/services/prebooking.service.test.ts](modules/prebooking/api/services/prebooking.service.test.ts)
3. [app/api/execute-prebooking/route.test.ts](app/api/execute-prebooking/route.test.ts) (si existe)

## Criterios de Aceptación

### Backend
- [ ] Cuando bookState=-12 y errorMssg contiene "misma hora", marcar prereserva como `completed`
- [ ] Cuando bookState=-12 y errorMssg contiene "días de antelación", mantener como `failed`
- [ ] Agregar campo `alreadyBookedManually` al resultado de la prereserva
- [ ] Logs claros diferenciando ambos casos

### Testing
- [ ] Test unitario para detección de "ya reservado manualmente"
- [ ] Test unitario para preservar comportamiento de "días de antelación"
- [ ] Test de integración en webhook de QStash

### UX
- [ ] UI muestra prereserva como exitosa cuando el usuario reservó manualmente
- [ ] Mensaje claro: "Ya reservaste esta clase manualmente"
- [ ] No permitir crear otra prereserva para la misma hora/día

## Notas Adicionales

### Consideraciones de Seguridad
- ✅ No hay cambios en autenticación
- ✅ No hay cambios en permisos
- ✅ Solo es lógica de interpretación de respuesta

### Performance
- ✅ Regex simple, impacto mínimo (~1-2ms)
- ✅ Sin queries adicionales a base de datos
- ✅ Sin llamadas API adicionales

### Escalabilidad
- ✅ Fácil agregar más patrones de mensaje si AimHarder cambia
- ✅ Compatible con futuros estados de reserva
- ✅ No rompe código existente
