# Refactorización de Booking: TanStack Query Migration

## Resumen Ejecutivo

Refactorizaremos el módulo de booking para usar **TanStack Query nativo** en lugar de custom caching, logrando:

- ✅ **Auto-refresh automático** cuando vuelve el foco a bookings
- ✅ **168 LOC menos** (-34% del módulo)
- ✅ **Código más limpio** y consistente con el resto del app
- ✅ **Mejor mantenimiento** (menos código custom = menos bugs)

---

## Problema Actual

### Dual Caching (Ineficiente)
```
useBooking Hook
    ↓
BookingBusiness (Cache #1)
    ↓
BookingContext (Cache #2)  ← Redundante!
```

### Resultado
- 488 LOC en el módulo de booking
- Lógica de caching esparcida en 3 capas
- Auto-refresh requeriría código custom
- Inconsistencia con otras features (boxes, prebookings)

---

## Solución: TanStack Query Native

### Arquitectura Nueva (Simple & Limpia)
```
useBookingsQuery Hook (TanStack Query)
    ↓
TanStack Query Cache (Single source of truth)
    ↓
BookingService (API calls only)

✨ refetchOnWindowFocus: true ← AUTO-REFRESH AUTOMÁTICO!
```

### Resultado
- 320 LOC en el módulo (168 LOC ahorrados)
- Caching centralizado en TanStack
- Auto-refresh "gratis" sin código custom
- Consistencia con rest of app

---

## Plan de Implementación (6 Fases)

### Fase 1: Crear `useBookingsQuery.hook.tsx` (NUEVO)

**Ubicación**: `modules/booking/hooks/useBookingsQuery.hook.tsx`

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { BookingService } from "../api/services/booking.service";
import { BookingUtils } from "../utils/booking.utils";
import { BookingDay } from "../models/booking.model";

export function useBookingsQuery(date: string, boxId: string) {
  const service = new BookingService();

  return useQuery<BookingDay>({
    queryKey: ["bookings", date, boxId],
    queryFn: async () => {
      // BookingService handles API calls + mapping
      const response = await service.getBookings(
        {
          day: BookingUtils.formatDateForApi(date),
          boxId,
          _: BookingUtils.generateCacheTimestamp(),
        },
        undefined
      );

      // Transform API response to BookingDay model
      return BookingMapper.mapBookingDay(response);
    },
    enabled: !!date && !!boxId,
    staleTime: 30 * 1000,        // 30 seconds (from global config)
    gcTime: 5 * 60 * 1000,       // 5 minutes (from global config)
    refetchOnWindowFocus: true,   // 🎯 AUTO-REFRESH ON FOCUS!
    refetchOnMount: "stale",      // Refetch if data is stale on mount
    retry: 1,                     // From global config
  });
}
```

**LOC**: ~50 lines (NEW)

---

### Fase 2: Simplificar `BookingBusiness.ts`

**Cambios**:
- ❌ Delete: `cache: Map<string, {...}>`
- ❌ Delete: `getCachedData()` method
- ❌ Delete: `setCachedData()` method
- ❌ Delete: `cleanupExpiredCache()` method
- ❌ Delete: `clearCache()` method
- ❌ Delete: `getCacheStats()` method
- ❌ Delete: `cacheEnabled`, `cacheTimeout` config
- ✅ Keep: `getBookingsForDay()` method (API call only)
- ✅ Keep: `validateBookingEligibility()` method
- ✅ Keep: `filterAndSortBookings()` method
- ✅ Keep: `getBookingStatistics()` method
- ✅ Keep: `enhanceBookingDay()` method

**Resultado**:
```
Before: 254 LOC (with caching logic)
After:  150 LOC (API calls only)
Save:   104 LOC (-40%)
```

---

### Fase 3: Refactorizar `useBooking.hook.tsx`

**Cambios**:
- ❌ Delete: Manual cache checking (lines 68-79)
- ❌ Delete: `bookingBusiness.clearCache()` (line 186)
- ❌ Delete: Cache action calls (lines 94-96, 202-203)
- ❌ Delete: `stateRef`/`actionsRef` (lines 44-51, 72-76)
- ❌ Delete: Manual loading/error management
- ✅ Keep: Date/box selection logic
- ✅ Keep: Statistics computation
- ✅ Add: TanStack Query integration

**Nuevo Hook**:
```typescript
export function useBooking(options: UseBookingOptions = {}): UseBookingReturn {
  const { autoFetch = true, onRefetch } = options;
  const { state, actions } = useBookingContext();

  // TanStack Query handles caching, loading, errors, auto-refresh
  const {
    data: bookingDay = null,
    isLoading,
    error,
    refetch: tanstackRefetch,
  } = useBookingsQuery(state.selectedDate, state.selectedBoxId);

  // Wrap refetch to call onRefetch callback
  const refetch = useCallback(async (): Promise<void> => {
    await tanstackRefetch();
    if (onRefetch) {
      await onRefetch();
    }
  }, [tanstackRefetch, onRefetch]);

  // Compute statistics
  const statistics = bookingDay
    ? bookingBusiness.getBookingStatistics(bookingDay.bookings)
    : null;

  return {
    bookingDay,
    isLoading,
    error,
    refetch,
    setDate: (date) => actions.setSelectedDate(date),
    setBox: (boxId) => actions.setSelectedBox(boxId),
    retryOnError: () => refetch(),
    statistics,
  };
}
```

**Resultado**:
```
Before: 234 LOC (with manual caching)
After:  120 LOC (TanStack integration only)
Save:   114 LOC (-49%)
```

---

### Fase 4: Mantener `BookingProvider` y `useBookingContext`

**Decisión**: ✅ KEEP (sin cambios)

**Por qué**:
- Aún gestiona estado UI (selectedDate, selectedBoxId)
- Usado por otros componentes (week-selector)
- TanStack Query es solo para data fetching
- Migración a URL params puede hacerse después

---

### Fase 5: Verificar Componentes

**Cambios Necesarios**: ❌ NINGUNO

Los componentes ya usan el hook `useBooking()`. La signatura del hook se mantiene idéntica, solo cambia la implementación interna.

**Componentes Afectados**:
- `booking-dashboard.component.tsx` - usa `useBooking()` ✅
- Week selector components - usan context ✅
- Booking cards - usan data del hook ✅

---

### Fase 6: Testing

#### Unit Tests
- Test `useBookingsQuery()` behavior
- Test query key structure
- Test refetch on focus
- Mock TanStack Query

#### Integration Tests
- Test `useBooking()` integration
- Test data flows through components
- Test loading states

#### Manual Testing
- Switch tabs away from booking screen
- Make a booking in another tab
- Return to booking screen → **data auto-refreshes** ✅

---

## Comparación: Antes vs Después

### Antes (Custom Caching)
```
Booking Screen
    ↓
useBooking() [234 LOC]
    ├─ Manual cache check
    ├─ Manual fetch logic
    ├─ Manual error handling
    └─ Manual refetch
        ↓
    BookingBusiness [254 LOC]
        ├─ Cache Map
        ├─ getCachedData()
        ├─ setCachedData()
        └─ clearCache()
            ↓
        BookingContext [Cache #2]
            ├─ cache: Map
            └─ CACHE_DAY action

Auto-Refresh: ❌ Requires custom code (visibilitychange listener)
Total LOC: 488 (+ event listeners in component)
```

### Después (TanStack Query)
```
Booking Screen
    ↓
useBooking() [120 LOC]
    ├─ useBookingsQuery()
    │   ↓
    │   TanStack Query Cache (Single source of truth)
    │       ├─ Automatic refetch on window focus ✨
    │       ├─ Built-in refetch logic
    │       ├─ Automatic error handling
    │       └─ Automatic loading states
    │
    └─ Keep statistics, date/box selection
        ↓
    BookingBusiness [150 LOC - API calls only]
    BookingContext [No cache - UI state only]

Auto-Refresh: ✅ Built-in (refetchOnWindowFocus: true)
Total LOC: 320 (no extra listeners needed!)
Savings: 168 LOC (-34%)
```

---

## Ventajas de esta Refactorización

| Aspecto | Antes | Después | Mejora |
|--------|-------|---------|--------|
| **Líneas de código** | 488 | 320 | -34% |
| **Capas de caching** | 2 (dual) | 1 (unified) | -50% |
| **Código custom** | Alto | Bajo | Menos bugs |
| **Auto-refresh** | ❌ Manual | ✅ Built-in | +Nativo |
| **Mantenimiento** | Difícil | Fácil | +Consistencia |
| **DevTools** | None | React Query DevTools | +Debug |

---

## Flujo de Auto-Refresh (Nueva)

### Escenario: Usuario hace una reserva, vuelve a la pantalla de bookings

```
1. Usuario en pantalla de bookings
   ↓
   [Booking Data Loaded: 3 available slots]

2. Usuario navega a otra pantalla (tab blur)
   ↓
   useBookingsQuery remueve listener de window focus

3. Usuario hace una reserva en otra app/navegador
   ↓
   [Booking Data Updated en backend: 2 available slots]

4. Usuario vuelve a pantalla de bookings (window focus)
   ↓
   TanStack Query detects `refetchOnWindowFocus: true`
   ↓
   Automatic refetch triggered
   ↓
   API call: GET /api/booking?day=2025-10-24&boxId=xxx
   ↓
   [Booking Data Refreshed: 2 available slots] ✅

5. UI Updates Automatically
   ↓
   Usuarios ven los datos más recientes instantly!
```

---

## Riesgos y Mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|--------|-----------|
| Breaking useBooking signature | Baja | Alto | Mantener signiture idéntica |
| Different caching behavior | Baja | Medio | TanStack es más sofisticado |
| Losing cache stats | Baja | Bajo | React Query DevTools |
| Tests failing | Media | Medio | Comprehensive test updates |

---

## Estimación de Esfuerzo

| Fase | Esfuerzo | Tiempo |
|------|----------|--------|
| 1. Create useBookingsQuery | Bajo | 0.5h |
| 2. Simplify BookingBusiness | Bajo | 1h |
| 3. Refactor useBooking | Medio | 2h |
| 4. Keep BookingProvider | None | 0h |
| 5. Verify Components | Bajo | 0.5h |
| 6. Update Tests | Medio | 1.5h |
| 7. Manual Testing | Bajo | 1h |
| **Total** | **Medio** | **~6-7 horas** |

---

## Próximos Pasos

1. ✅ **Plan Aprobado** (este documento)
2. ⏭️ **Implementar Fase 1-5** (crear hooks, simplificar)
3. ⏭️ **Update Tests** (asegurar cobertura)
4. ⏭️ **Manual Testing** (verificar auto-refresh)
5. ⏭️ **Commit & PR** (review and merge)

---

## Preguntas Frecuentes

### ¿Perderemos funcionalidad?
No. Mantenemos toda la funcionalidad y ganamos auto-refresh automático.

### ¿Es compatible con el resto del app?
Sí. El resto del app (boxes, prebookings) ya usa TanStack Query. Esta refactorización alinea booking con el patrón del app.

### ¿Qué pasa si el usuario no tiene conexión?
TanStack Query maneja fallidos gracefully - muestra última data en caché.

### ¿Puedo seguir usando `refetch()` manualmente?
Sí. TanStack Query permite refetch() manual además del auto-refresh.

### ¿Qué pasa con la BookingBusiness cache?
Se elimina. TanStack Query gestiona el caché de forma más eficiente.

### ¿Puedo rollback si falla?
Sí. Esta refactorización es backward compatible - componentes usan el mismo hook interface.

