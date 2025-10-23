# Sesión: Timezone Prebooking Fix

## Problema Principal
Las prebookings se están creando con la hora incorrecta debido a mala gestión de timezones. El sistema actual intenta calcular offsets en el cliente y enviarlos al backend, pero esto es frágil y no maneja bien DST.

**Ejemplo del problema:**
- Clase programada: 08:00 en Madrid
- Prebooking creada: 09:00 en Madrid (1 hora de diferencia)
- Causa raíz: DST transition - Oct 28 es UTC+1 (CET), no UTC+2 (CEST)

## Flujo Actual (Problema)
1. Frontend calcula offset desde fecha actual → `08:00+02:00`
2. Backend recibe `08:00+02:00` y calcula UTC: 08:00 - 02:00 = 06:00 UTC
3. Oct 28 es UTC+1, así que 06:00 UTC = 07:00 Madrid (incorrecto)

## Pregunta Clave para el Arquitecto
¿Cuál debería ser la estrategia correcta?

**Opción A: Todo en UTC**
- Frontend calcula hora UTC de la clase y envía directamente en UTC
- Backend almacena en UTC
- Frontend convierte UTC → timezone local para mostrar

**Opción B: Enviar ISO 8601 con offset correcto del día**
- Frontend calcula offset para la FECHA de la clase (no fecha actual)
- Envía `08:00+01:00` (offset correcto para Oct 28)
- Backend: `08:00 - 01:00 = 07:00 UTC`

**Opción C: Enviar hora local + timezone identifier**
- Frontend envía: `{ time: "08:00", timezone: "Europe/Madrid", date: "2025-10-28" }`
- Backend usa date-fns-tz para convertir correctamente

**Opción D: Servidor obtiene offset del cliente via JavaScript**
- Frontend solo envía hora local
- Backend realiza la conversión UTC usando el offset que el cliente proporciona en un header separado

## Contexto Técnico
- **Frontend**: Next.js, TypeScript, date-fns
- **Backend**: FastAPI (Vercel deployment)
- **Datos**: Supabase
- **Zona horaria principal**: Europe/Madrid
- **Desafío**: DST transitions hacen que offset cambie dentro del mes

## Archivos Involucrados
- Frontend: `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx` (líneas 138-146)
- Backend: `modules/prebooking/utils/error-parser.utils.ts` (parseEarlyBookingError)
- Backend: `modules/prebooking/api/services/prebooking.service.ts` (almacenamiento)

## Estado Actual
- Implementación incompleta de ISO 8601 offset
- Offset calculado desde fecha actual, no fecha de clase
- Tests muestran fallos para Oct 28 (DST transition)

## Decisión del Arquitecto (nextjs-architect)
**Recomendación:** Opción B (Frontend calcula UTC con fromZonedTime)

## Análisis Técnico Completado

### Validación de Viabilidad Técnica ✅

**Archivo de pruebas:** `timezone-analysis.test.ts`

**Resultados:**
```
✅ fromZonedTime funciona con cualquier IANA timezone
✅ Madrid - Oct 28, 2025 08:00 (CET, UTC+1) → 07:00 UTC (correcto)
✅ Madrid - July 15, 2025 08:00 (CEST, UTC+2) → 06:00 UTC (correcto)
✅ Maneja DST transitions automáticamente
✅ Timezone del navegador: Intl.DateTimeFormat().resolvedOptions().timeZone
✅ Soportado en >90% de navegadores modernos
```

### Cambios Necesarios

**1. Frontend (booking-dashboard.component.tsx):**
```typescript
import { fromZonedTime } from 'date-fns-tz';

// Obtener timezone del navegador
const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Construir fecha completa en timezone local
const dateString = `${bookingDay.date} ${classTime}:00`;

// Convertir a UTC
const classDateUTC = fromZonedTime(dateString, browserTimezone);

// Enviar ISO 8601 UTC puro
const bookingRequest = {
  // ...
  classTimeUTC: classDateUTC.toISOString(), // "2025-10-28T07:00:00.000Z"
};
```

**2. Backend (app/api/booking/route.ts):**
```typescript
// Recibir classTimeUTC en lugar de classTime
const classTimeUTC = body.classTimeUTC;

// Validar ISO 8601 format
if (!classTimeUTC || isNaN(new Date(classTimeUTC).getTime())) {
  return NextResponse.json({ error: "Invalid classTimeUTC" }, { status: 400 });
}

// Pasar Date object a parseEarlyBookingError
const parsed = parseEarlyBookingError(
  bookingResponse.errorMssg,
  validatedRequest.data.day,
  new Date(classTimeUTC)  // Date object en UTC
);
```

**3. Backend (error-parser.utils.ts):**
```typescript
// Cambiar firma de función
export function parseEarlyBookingError(
  errorMessage: string | undefined,
  classDay: string,
  classTimeUTC: Date  // Date object en lugar de string
): ParsedEarlyBookingError | null {
  // ...
  const daysAdvance = parseInt(daysMatch[1], 10);

  // Ya no necesita parsing ni fromZonedTime
  const classDateUTC = classTimeUTC;

  // Solo restar días
  const availableAt = sub(classDateUTC, { days: daysAdvance });

  return { availableAt, daysAdvance, classDate: classDateUTC };
}
```

**4. API Schema (booking.api.ts):**
```typescript
export const BookingCreateRequestSchema = z.object({
  // ...
  classTimeUTC: z.string().datetime(), // Valida ISO 8601
});
```

### Formato de API Request

**ANTES:**
```json
{
  "day": "20251028",
  "classTime": "08:00"  // Solo hora, sin timezone
}
```

**DESPUÉS:**
```json
{
  "day": "20251028",
  "classTimeUTC": "2025-10-28T07:00:00.000Z"  // ISO 8601 UTC puro
}
```

### Tests Necesarios

**Archivos a actualizar:**
1. `modules/prebooking/utils/error-parser.utils.test.ts` (cambiar string → Date)
2. Frontend integration tests para validar conversión

**Nuevos test cases:**
- Oct 28 (CET, UTC+1): 08:00 local → 07:00 UTC ✅
- July 15 (CEST, UTC+2): 08:00 local → 06:00 UTC ✅
- DST transition days ✅
- Midnight edge cases ✅

### Ventajas de Opción B

1. ✅ **Corrección DST:** Calcula offset correcto para la fecha de clase
2. ✅ **Simplicidad backend:** Backend solo recibe UTC, no hace conversión
3. ✅ **Timezone-agnostic:** Funciona desde cualquier timezone del navegador
4. ✅ **Sin hardcoding:** Elimina `'Europe/Madrid'` del backend
5. ✅ **ISO 8601 estándar:** Formato universal y bien soportado
6. ✅ **Menos bugs:** Backend solo resta días, lógica más simple

### Plan de Implementación

**Fase 1 (Sin breaking changes):**
1. Agregar `classTimeUTC` opcional al schema
2. Backend acepta ambos formatos temporalmente
3. Tests para nuevo formato

**Fase 2 (Migración):**
1. Frontend envía ambos campos
2. Backend prioriza `classTimeUTC`
3. Validar en producción

**Fase 3 (Cleanup):**
1. Eliminar `classTime` del frontend
2. Eliminar soporte de `classTime` del backend
3. Actualizar tests

**Tiempo estimado:** 1-2 semanas

### Documentación Completa
Ver: `TECHNICAL_ANALYSIS_OPTION_B.md` para análisis detallado.

## ¿Funciona para CUALQUIER box en el mundo?

### SÍ ✅ - Aquí está la razón:

**Flujo con Opción B:**

1. **Usuario en Madrid booking clase en Madrid (08:00 CET)**
   - Navegador obtiene: `Intl.DateTimeFormat().resolvedOptions().timeZone` = "Europe/Madrid"
   - Calcula: `fromZonedTime("2025-10-28 08:00", "Europe/Madrid")` = 07:00 UTC
   - Envía: `classTimeUTC: "2025-10-28T07:00:00.000Z"`
   - Backend: Recibe UTC puro, resta días, todo funciona ✅

2. **Usuario en Nueva York booking clase en Nueva York (08:00 EDT)**
   - Navegador obtiene: `Intl.DateTimeFormat().resolvedOptions().timeZone` = "America/New_York"
   - Calcula: `fromZonedTime("2025-10-28 08:00", "America/New_York")` = 12:00 UTC
   - Envía: `classTimeUTC: "2025-10-28T12:00:00.000Z"`
   - Backend: Recibe UTC puro, resta días, todo funciona ✅

3. **Usuario en Tokyo booking clase en Tokyo (08:00 JST)**
   - Navegador obtiene: `Intl.DateTimeFormat().resolvedOptions().timeZone` = "Asia/Tokyo"
   - Calcula: `fromZonedTime("2025-10-28 08:00", "Asia/Tokyo")` = 23:00 UTC (día anterior)
   - Envía: `classTimeUTC: "2025-10-27T23:00:00.000Z"`
   - Backend: Recibe UTC puro, resta días, todo funciona ✅

### ¿Por qué funciona?

**El secreto:** El navegador SIEMPRE sabe su propio timezone gracias a `Intl.DateTimeFormat().resolvedOptions().timeZone`

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO AGNÓSTICO                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (CUALQUIER ubicación)                            │
│  1. Lee: "¿Qué timezone estoy en?" ← Navegador sabe esto  │
│  2. Lee: "¿Qué hora es la clase?" ← Usuario ingresa        │
│  3. Calcula: hora local → UTC usando IANA timezone DB      │
│  4. Envía: UTC puro al backend                             │
│                ↓                                            │
│  Backend (Vercel, cualquier región)                        │
│  1. Recibe: UTC puro (sin ambigüedad)                      │
│  2. Operación: UTC - days = resultado en UTC               │
│  3. Almacena: UTC en Supabase                              │
│                ↓                                            │
│  Frontend (mostrar)                                         │
│  1. Lee: UTC de Supabase                                   │
│  2. Convierte: UTC → timezone local del usuario            │
│  3. Muestra: "Disponible el 12 de Oct a las 08:00"        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Casos especiales manejados:

✅ **DST transitions (cambios de horario):**
- `fromZonedTime` usa IANA timezone database
- Automáticamente calcula offset correcto para cada fecha
- Oct 26 en Madrid: UTC+2 (CEST)
- Oct 27 en Madrid: UTC+1 (CET)
- Sin problemas ✅

✅ **Usuarios viajando a otro país:**
- El navegador detecta timezone del dispositivo
- Si usuario madrileño viajas a NYC, navegador detecta America/New_York
- Calcula correctamente ✅

✅ **Mismo box, múltiples usuarios de distintos países:**
- Todos envían hora UTC correctamente calculada para su timezone
- Backend recibe UTC desde todos, sin problemas ✅

### Ventajas globales:

| Característica | Resultado |
|---|---|
| 🌍 Funciona en España | ✅ Sí |
| 🌎 Funciona en USA | ✅ Sí |
| 🌏 Funciona en Asia | ✅ Sí |
| ⏰ Maneja DST | ✅ Automático |
| 👤 Usuario viajando | ✅ Detecta timezone |
| 📱 Múltiples devices | ✅ Cada uno calcula correcto |
| 🔒 Sin hardcoding | ✅ Zero timezone hardcoding |
| 🧪 Testeable | ✅ Mockear timezone fácil |

## Implementación Completada ✅

### Fase 1: Frontend UTC Conversion

**Archivo:** `common/utils/timezone.utils.ts` (Nueva utilidad)
- ✅ `convertLocalToUTC()`: Convierte hora local → UTC
- ✅ `convertUTCToLocal()`: Convierte UTC → hora local
- ✅ `formatUTCForDisplay()`: Formatea para mostrar
- ✅ `getBrowserTimezone()`: Obtiene timezone con fallback
- ✅ 16 tests pasando ✅

**Archivo:** `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx`
- ✅ Import de `convertLocalToUTC`
- ✅ Calcula UTC para la fecha de clase
- ✅ Envía `classTimeUTC` ISO 8601 UTC

### Fase 2: Backend Updates

**Archivo:** `modules/booking/api/models/booking.api.ts`
- ✅ Agregado `classTimeUTC: z.string().datetime().optional()`

**Archivo:** `app/api/booking/route.ts`
- ✅ Extrae `classTimeUTC`
- ✅ Valida formato ISO 8601
- ✅ Convierte a Date object

**Archivo:** `modules/prebooking/utils/error-parser.utils.ts`
- ✅ Firma: `classTimeUTC?: Date` (antes: `classTime?: string`)
- ✅ Eliminadas conversiones de timezone
- ✅ Backend solo resta días
- ✅ 40 tests pasando ✅

### Test Results

```
✅ error-parser.utils.test.ts: 40/40 passed
✅ timezone.utils.test.ts: 16/16 passed
Total: 56/56 tests passing
```

## Estado Actual
✅ Implementación completada
✅ Tests pasando (56/56)
✅ Agnóstico al timezone
✅ Funciona PARA TODO EL MUNDO
✅ DST manejado automáticamente

## Siguiente Paso
⏳ Testing en producción (Vercel)
