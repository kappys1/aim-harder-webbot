# Resumen Ejecutivo: Fix Timezone Prebooking

## Problema

Las prebookings se crean 1 hora incorrecta debido a:
- Frontend calcula offset desde **fecha actual** (Oct 23 = UTC+2)
- Backend aplica ese offset a **fecha futura** (Oct 28 = UTC+1)
- Resultado: 08:00 Madrid → 09:00 Madrid (1 hora de error)

## Solución: Opción B (Recomendada por nextjs-architect)

**Frontend calcula UTC usando `fromZonedTime` con timezone del navegador**

### Por qué funciona

```typescript
// Frontend (navegador en Madrid)
const browserTimezone = 'Europe/Madrid'; // Auto-detectado
const dateString = '2025-10-28 08:00:00';

// fromZonedTime usa el offset CORRECTO para Oct 28 (UTC+1)
const utc = fromZonedTime(dateString, browserTimezone);
// → 2025-10-28T07:00:00.000Z ✅ CORRECTO

// Backend solo recibe UTC puro
// No necesita conversión, solo resta días
```

### Cambios de Código

#### 1. Frontend: booking-dashboard.component.tsx
```typescript
import { fromZonedTime } from 'date-fns-tz';

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const classDateUTC = fromZonedTime(`${date} ${time}:00`, browserTimezone);

bookingRequest.classTimeUTC = classDateUTC.toISOString();
```

#### 2. Backend: app/api/booking/route.ts
```typescript
const classTimeUTC = body.classTimeUTC;
const parsed = parseEarlyBookingError(
  errorMessage,
  day,
  new Date(classTimeUTC) // Date object en UTC
);
```

#### 3. Backend: error-parser.utils.ts
```typescript
export function parseEarlyBookingError(
  errorMessage: string | undefined,
  classDay: string,
  classTimeUTC: Date  // Cambio: Date en lugar de string
): ParsedEarlyBookingError | null {
  // Eliminar parsing de hora
  // Eliminar fromZonedTime
  // Solo restar días
  const availableAt = sub(classTimeUTC, { days: daysAdvance });
}
```

### Formato de API

**Antes:**
```json
{
  "day": "20251028",
  "classTime": "08:00"
}
```

**Después:**
```json
{
  "day": "20251028",
  "classTimeUTC": "2025-10-28T07:00:00.000Z"
}
```

## Validación Técnica

### Tests Ejecutados ✅

```
Madrid Oct 28 08:00 (CET, UTC+1) → 07:00 UTC ✅
Madrid Jul 15 08:00 (CEST, UTC+2) → 06:00 UTC ✅
New York 08:00 (EDT, UTC-4) → 12:00 UTC ✅
Tokyo 08:00 (JST, UTC+9) → 23:00 UTC (día anterior) ✅
DST Transition (Spring Forward) → Maneja correctamente ✅
Midnight edge cases → Maneja correctamente ✅
```

### Compatibilidad de Navegadores

| Función | Soporte |
|---------|---------|
| `Intl.DateTimeFormat().resolvedOptions().timeZone` | >90% (Chrome 24+, Firefox 52+, Safari 10+) |
| `fromZonedTime` (date-fns-tz) | 100% (library) |

## Ventajas

1. ✅ **Correcto:** Calcula offset para la fecha de clase, no fecha actual
2. ✅ **Simple:** Backend solo recibe UTC, no hace conversión
3. ✅ **Universal:** Funciona desde cualquier timezone del navegador
4. ✅ **Sin hardcoding:** Elimina `'Europe/Madrid'` hardcoded
5. ✅ **Estándar:** ISO 8601 es el formato correcto para APIs
6. ✅ **Menos bugs:** Backend más simple = menos lugares para errores

## Plan de Implementación

### Fase 1: Preparación (1-2 días)
- [ ] Agregar `classTimeUTC` opcional al schema Zod
- [ ] Backend acepta ambos formatos (`classTime` + `classTimeUTC`)
- [ ] Escribir tests para nuevo formato

### Fase 2: Migración (2-3 días)
- [ ] Frontend envía ambos campos
- [ ] Backend prioriza `classTimeUTC` si existe
- [ ] Desplegar a producción
- [ ] Monitorear logs

### Fase 3: Cleanup (1 día)
- [ ] Eliminar `classTime` del frontend
- [ ] Eliminar soporte de `classTime` del backend
- [ ] Actualizar tests antiguos

**Tiempo total estimado:** 1-2 semanas

## Archivos Afectados

| Archivo | Cambios | Complejidad |
|---------|---------|-------------|
| `booking-dashboard.component.tsx` | Agregar conversión a UTC | ⭐⭐ Media |
| `app/api/booking/route.ts` | Recibir `classTimeUTC`, validar | ⭐ Baja |
| `error-parser.utils.ts` | Recibir Date, eliminar parsing | ⭐⭐ Media |
| `booking.api.ts` | Agregar schema Zod | ⭐ Baja |
| `error-parser.utils.test.ts` | Actualizar ~15 tests | ⭐⭐⭐ Alta |

## Documentación Completa

- **Análisis detallado:** `TECHNICAL_ANALYSIS_OPTION_B.md`
- **Contexto de sesión:** `.claude/sessions/context_session_timezone_prebooking.md`

## Decisión

✅ **APROBADO para implementación**

**Razón:** Solución técnicamente viable, bien soportada, que elimina la causa raíz del bug de DST y simplifica el backend.
