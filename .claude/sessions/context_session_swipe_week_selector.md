# Context Session: Swipe Gesture for Week Selector

## Feature Request
Implementar gestos de swipe en mobile para cambiar de semana en el selector de semanas:
- Swipe hacia la izquierda → Siguiente semana
- Swipe hacia la derecha → Semana anterior

## Current Architecture Analysis

### Components Structure
- **booking-dashboard.component.tsx** (línea 478-485): Contiene el WeekSelector con sticky positioning
- **week-selector.component.tsx**: Componente principal del selector semanal
  - Usa el hook `useWeekNavigation` para la lógica de navegación
  - Renderiza un grid de 7 días (línea 109-124)
  - Tiene botones de navegación con ChevronLeft/Right (línea 74-106)

### Hook: useWeekNavigation.hook.tsx
- **navigateToNextWeek()** (línea 50-58): Navega a la siguiente semana
- **navigateToPrevWeek()** (línea 60-79): Navega a la semana anterior con validación de fechas pasadas
- **isPrevWeekDisabled** (línea 140-148): Lógica para deshabilitar navegación a semanas pasadas

### Current State Management
- `currentWeekStart`: Estado que controla qué semana se muestra
- `isNavigating`: Estado para prevenir múltiples navegaciones simultáneas
- Ya existe la lógica de navegación lista para ser reutilizada

## Technical Considerations

### 1. Swipe Detection Options

#### Option A: React Custom Hook (Recomendado para mantener consistencia)
**Pros:**
- ✅ Mantiene toda la lógica en React
- ✅ Fácil de testear
- ✅ No requiere dependencias externas
- ✅ Control total sobre la implementación

**Cons:**
- ⚠️ Necesita implementar la lógica de detección de swipe manualmente

**Implementación:**
```typescript
// hooks/useSwipeGesture.hook.ts
const useSwipeGesture = (
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 50
) => {
  // Touch event handlers con detección de dirección
}
```

#### Option B: Librería react-swipeable
**Pros:**
- ✅ Solución probada y robusta
- ✅ Maneja edge cases automáticamente
- ✅ Soporte para diferentes tipos de gestos

**Cons:**
- ⚠️ Añade dependencia externa (~5KB)
- ⚠️ Posible overkill para caso de uso simple

#### Option C: Framer Motion (Ya está en el proyecto)
**Pros:**
- ✅ Ya existe como dependencia
- ✅ Soporte de animaciones suaves
- ✅ API declarativa

**Cons:**
- ⚠️ Más pesado para un simple swipe
- ⚠️ Requiere wrapper component

### 2. UX Considerations

#### Mobile Detection
- ✅ Solo activar swipe en mobile/tablet (max-width: 768px)
- ✅ No interferir con scroll vertical
- ✅ Feedback visual durante el swipe (opcional: preview de la siguiente/anterior semana)

#### Accessibility
- ✅ Mantener botones de navegación visibles
- ✅ No eliminar métodos alternativos de navegación
- ✅ Asegurar que swipe no interfiera con lectores de pantalla

#### Performance
- ✅ Debouncing para evitar múltiples swipes rápidos (ya existe `isNavigating`)
- ✅ Prevenir swipe durante animaciones

### 3. Integration Points

**En WeekSelector component:**
1. Añadir el hook de swipe detection
2. Pasar `navigateToNextWeek` y `navigateToPrevWeek` al hook
3. Aplicar los event listeners al contenedor del grid
4. Respetar el estado `isNavigating` y `isPrevWeekDisabled`

## Questions for SubAgents

### Para frontend-test-engineer:
1. ¿Qué casos de prueba son críticos para los gestos de swipe?
2. ¿Cómo mockear touch events en los tests?

### Para ui-ux-analyzer:
1. ¿Se debe añadir feedback visual durante el swipe (ej: preview de la semana)?
2. ¿Los botones de navegación deben ocultarse en mobile o mantenerse?
3. ¿Necesitamos un threshold mínimo para el swipe o cualquier movimiento cuenta?

### Para shadcn-ui-architect:
1. ¿Existe algún componente o patrón en shadcn para gestos?
2. ¿Cómo integrar esto con los estilos existentes de TailwindCSS?

## Initial Recommendation

**Opción preferida: Custom Hook (Option A)** por las siguientes razones:

1. **Simplicidad**: El caso de uso es simple (2 direcciones básicas)
2. **Sin dependencias**: No añade peso al bundle
3. **Control**: Podemos ajustar exactamente el comportamiento que necesitamos
4. **Testeable**: Fácil de testear con renderHook

### Implementation Plan (Draft)

```typescript
// 1. Crear hook personalizado: useSwipeGesture.hook.ts
// 2. Integrar en week-selector.component.tsx
// 3. Añadir clases CSS para feedback visual (opcional)
// 4. Tests unitarios para el hook
// 5. Tests de integración para el WeekSelector
```

## Files to Modify

1. **New**: `modules/booking/pods/booking-dashboard/components/week-selector/hooks/useSwipeGesture.hook.ts`
2. **Modify**: `modules/booking/pods/booking-dashboard/components/week-selector/week-selector.component.tsx`
3. **New**: `modules/booking/pods/booking-dashboard/components/week-selector/hooks/useSwipeGesture.hook.test.tsx`
4. **Modify**: `modules/booking/pods/booking-dashboard/components/week-selector/week-selector.component.test.tsx`

## Next Steps

1. ✅ Consultar con subagents (frontend-test-engineer, ui-ux-analyzer, shadcn-ui-architect)
2. ⏳ Refinar el plan basado en feedback
3. ⏳ Implementar el hook de swipe
4. ⏳ Integrar en WeekSelector
5. ⏳ Añadir tests
6. ⏳ QA validation con qa-criteria-validator
