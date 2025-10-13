# 🔍 ANÁLISIS EXHAUSTIVO - Code Cleanup & Refactoring

## Session ID: code_cleanup
**Date**: 2025-10-03
**Goal**: Detectar código muerto, sobre-ingeniería, duplicación y oportunidades de simplificación en TODO el codebase

---

# 📊 RESUMEN EJECUTIVO

## Problemas Críticos Detectados:
1. **🔴 Capa de Business INNECESARIA** en todos los módulos (violación KISS/YAGNI)
2. **🔴 Código DUPLICADO** en utils, servicios y lógica de negocio
3. **🔴 API Routes SOBREDIMENSIONADAS** (485 líneas route.ts)
4. **🟡 Sobre-ingeniería en Hooks** (doble estado + múltiples cachés)
5. **🟡 Servicios fragmentados** sin cohesión clara
6. **⚫ Console.logs en producción** (8 archivos)
7. **⚫ CORS headers duplicados** en todas las routes

## Métricas Globales:
```
Total archivos TS/TSX: 112
Líneas de código total: ~11,702

Top 5 archivos más grandes:
568 líneas - booking-dashboard.component.tsx (MEGA-COMPONENTE)
485 líneas - app/api/booking/route.ts (API ROUTE)
392 líneas - prebooking.service.ts
361 líneas - supabase-session.service.ts
344 líneas - booking.service.ts
```

---

# 🔴 PARTE 1: PROBLEMAS POR MÓDULO

## 1.1 AUTH MODULE (Fragmentación Extrema)

### Estructura Actual:
```
modules/auth/
  ├── api/services/ (6 servicios!)
  │   ├── aimharder-auth.service.ts (308 líneas)
  │   ├── aimharder-refresh.service.ts (204 líneas)
  │   ├── auth.service.ts (130 líneas - wrapper inútil)
  │   ├── supabase-session.service.ts (361 líneas)
  │   ├── cookie.service.ts
  │   └── html-parser.service.ts
  ├── hooks/
  │   ├── useAuth.hook.tsx
  │   └── useTokenRefresh.hook.tsx (complejo)
  └── pods/login/
```

### 🔴 Problemas Críticos:

#### A. **AuthService es un wrapper inútil**
```typescript
// auth.service.ts - TODO ES REDIRECCIÓN
class AuthService {
  async login(request: LoginRequest): Promise<LoginResponse> {
    // Solo llama a /api/auth/aimharder
    const response = await fetch('/api/auth/aimharder', {...});
    return AuthMapper.fromLoginApiResponse(data);
  }

  async logout(email: string): Promise<void> {
    // VACÍO - comentario dice "soft logout"
    // No hace NADA
  }

  // Métodos probablemente no usados:
  getCookieValue(name: string) // ¿Se usa?
  getAimharderCookies() // ¿Se usa?
}
```
**Impacto**: Capa de indirección innecesaria, 130 líneas desperdiciadas

#### B. **Servicios Aimharder duplican lógica**
```typescript
// aimharder-auth.service.ts
- buildRefreshUrl() // Construye URL
- Rate limiting manual
- Cache de intentos manual

// aimharder-refresh.service.ts
- buildRefreshUrl() // DUPLICADO
- extractRefreshData() // Parsing HTML
```

#### C. **Supabase Session Service es MEGA-CLASE**
- 361 líneas
- Mezcla CRUD + validaciones + lógica de negocio
- Tiene métodos como `isSessionValid()` que podrían ser utils

**Solución**: Consolidar en 2-3 servicios cohesivos

---

## 1.2 BOOKING MODULE (Triple Caché + Business Innecesaria)

### Estructura Actual:
```
modules/booking/
  ├── business/booking.business.ts (250 líneas - INNECESARIA)
  ├── hooks/
  │   ├── useBookingContext.hook.tsx (195 líneas - Context global)
  │   └── useBooking.hook.tsx (188 líneas - Hook local)
  ├── api/services/booking.service.ts (344 líneas)
  └── utils/booking.utils.ts (209 líneas)
```

### 🔴 Problemas Críticos:

#### A. **TRIPLE SISTEMA DE CACHÉ**
```typescript
// 1. BookingContext tiene cache
interface BookingState {
  cache: Map<string, BookingDay>;  // ❌ CACHE 1
}

// 2. useBooking usa el cache del context
const cacheKey = BookingUtils.getCacheKey(...);
if (currentState.cache.has(cacheKey)) // ❌ USA CACHE 1

// 3. BookingBusiness TAMBIÉN tiene cache
class BookingBusiness {
  private cache: Map<string, { data: BookingDay; timestamp: number }>; // ❌ CACHE 2

  // ❌ Y implementa retry manual (React Query lo hace)
  for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++)
}
```
**Impacto**: Confusión, inconsistencias, React Query ya hace todo esto

#### B. **BookingBusiness es redundante**
```typescript
// BookingBusiness simplemente llama al service
async getBookingsForDay(...) {
  // Cache manual (React Query lo hace)
  const cached = this.getCachedData(cacheKey);

  // Retry manual (React Query lo hace)
  for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++)

  // Finalmente llama al service
  const response = await this.bookingService.getBookings(params, cookies);

  // Y mapea (podría ser inline)
  const bookingDay = BookingMapper.mapBookingDay(response);
}
```
**250 líneas que se reducen a una llamada con React Query**

#### C. **useBookingContext + useBooking = Duplicación**
- `useBookingContext`: Estado global, actions, computed
- `useBooking`: Estado local, fetchBookings, setDate, setBox
- **Responsabilidades mezcladas**, difícil entender quién hace qué

#### D. **booking-dashboard.component.tsx = MEGA-COMPONENTE**
- 568 líneas en un solo archivo
- Mezcla UI + lógica + estados
- Necesita segregación

**Solución**:
1. Eliminar `BookingBusiness`
2. Un solo hook con React Query
3. Eliminar cachés manuales
4. Split mega-componente

---

## 1.3 PREBOOKING MODULE (Business es solo orquestación)

### Estructura:
```
modules/prebooking/
  ├── business/prebooking-scheduler.business.ts (223 líneas)
  ├── api/services/prebooking.service.ts (392 líneas)
  ├── utils/error-parser.utils.ts (194 líneas)
  └── pods/
```

### 🟡 Problemas:

#### A. **PreBookingScheduler no aporta valor**
```typescript
// prebooking-scheduler.business.ts
class PreBookingScheduler {
  async execute() {
    // 1. Query service
    const readyPrebookings = await preBookingService.findReadyToExecute(now);

    // 2. Loop y llama a servicios
    for (let prebooking of prebookings) {
      const session = await SupabaseSessionService.getSession(...);
      const bookingResponse = await bookingService.createBooking(...);
      await preBookingService.markCompleted(...);
    }
  }
}
```
**Es solo orquestación, podría estar en la API route directamente**

#### B. **Servicio muy grande**
- 392 líneas
- Mezcla CRUD + lógica de claiming + updates
- Muchos métodos similares (`markCompleted`, `markFailed`, `updateStatus`)

**Solución**:
1. Mover orquestación a API route
2. Simplificar service, consolidar métodos

---

## 1.4 BOXES MODULE (Business es solo fetch wrapper)

### Estructura:
```
modules/boxes/
  ├── business/box-management.business.ts (113 líneas)
  ├── api/services/ (3 servicios)
  │   ├── box.service.ts (165 líneas)
  │   ├── box-detection.service.ts
  │   └── box-access.service.ts
  ├── hooks/ (3 hooks)
  └── utils/ (2 utils)
```

### 🟡 Problemas:

#### A. **BoxManagementBusiness es solo fetch wrapper**
```typescript
// TODA la clase hace esto:
static async detectBoxes(request) {
  const response = await fetch('/api/boxes/detect', {...});
  const data = await response.json();
  return { boxes: BoxMapper.boxWithAccessListToDomain(data.boxes) };
}
```
**113 líneas para hacer fetch y mapear. No aporta valor.**

#### B. **3 servicios de boxes fragmentados**
- `box.service.ts`: CRUD de boxes
- `box-detection.service.ts`: Detectar boxes del HTML
- `box-access.service.ts`: Validar acceso

**¿Por qué separados?** Podrían ser un solo servicio cohesivo

**Solución**:
1. Eliminar `BoxManagementBusiness`
2. Consolidar servicios en uno
3. Usar React Query directamente

---

# 🔴 PARTE 2: API ROUTES (DUPLICACIÓN MASIVA)

## 2.1 CORS Headers Duplicados (10 veces)

### Problema:
```typescript
// EN CADA ROUTE (booking, prebooking, boxes, auth...):
return NextResponse.json(data, {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  },
});

// Y método OPTIONS duplicado en cada route:
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: { /* MISMO OBJETO CORS */ },
  });
}
```

**Archivos afectados**: 10+ routes
**Impacto**: Mantenimiento difícil, cambios en 10 lugares

**Solución**:
```typescript
// common/utils/api.utils.ts
export const CORS_HEADERS = {...};
export const withCORS = (response) => {...};
```

---

## 2.2 app/api/booking/route.ts (485 LÍNEAS!)

### Problemas:

#### A. **Código duplicado en cada método**
```typescript
// GET, POST, DELETE todos hacen:
const userEmail = request.headers.get("x-user-email") || "alexsbd1@gmail.com";
const session = await SupabaseSessionService.getSession(userEmail);
if (!session) {
  return NextResponse.json({ error: "..." }, { status: 401 });
}
```
**Duplicado 3 veces en el mismo archivo**

#### B. **Lógica de negocio en API route**
```typescript
// POST tiene:
- Validación de schemas (OK)
- Lógica de prebooking (debería estar en servicio)
- Límites de prebooking (debería estar en servicio)
- Scheduling de QStash (debería estar en servicio)
- 5 bloques if/else gigantes para book states

// 200 líneas de lógica de negocio
if (bookingResponse.bookState === BOOKED) {
  // ...
} else if (bookState === ERROR_EARLY_BOOKING) {
  // Crear prebooking
  // Validar límites
  // Programar QStash
  // ...
} else if (bookState === ERROR_MAX_BOOKINGS) {
  // ...
}
```

**Solución**: Extraer a service layer, route solo coordina

---

## 2.3 Validación de usuario repetida

```typescript
// EN TODAS LAS ROUTES:
const userEmail = request.headers.get("x-user-email") || "alexsbd1@gmail.com";
```

**Problema**:
- Hardcoded fallback
- Duplicado en 8+ archivos
- No hay middleware de auth

**Solución**: Middleware de auth centralizado

---

# 🔴 PARTE 3: HOOKS (Complejidad innecesaria)

## 3.1 Booking Hooks (2 hooks hacen lo mismo)

```
modules/booking/hooks/
  ├── useBookingContext.hook.tsx (195 líneas)
  └── useBooking.hook.tsx (188 líneas)
```

### Problemas:

#### A. **useBookingContext**: Context + Reducer + Actions
```typescript
// Estado global con reducer
const [state, dispatch] = useReducer(bookingReducer, initialState);

// 8 actions diferentes
actions: {
  setLoading, setError, setCurrentDay, setSelectedDate,
  setSelectedBox, clearCache, cacheDay, reset
}

// Computed values
computed: {
  hasBookings, availableBookings, userBookings
}
```

#### B. **useBooking**: Fetch + Cache + Loading
```typescript
// USA useBookingContext pero TAMBIÉN tiene:
const [bookingBusiness] = useState(() => new BookingBusiness());

// Y refs para evitar stale closures
const stateRef = useRef(state);
const actionsRef = useRef(actions);

// Y lógica de fetch con cache manual
const fetchBookings = useCallback(async () => {
  if (currentState.cache.has(cacheKey)) { /* ... */ }
  // ...
});
```

**PROBLEMA**:
- Dos sistemas de estado (context + local)
- Refs para workaround de closures
- Business layer innecesaria
- Cache manual duplicado

**Solución**: Un solo hook con React Query

---

## 3.2 Token Refresh Hook (useTokenRefresh)

```typescript
// Complejidad para refrescar cada 25min
useEffect(() => {
  const interval = setInterval(() => {
    refreshToken();
  }, 25 * 60 * 1000);

  return () => clearInterval(interval);
}, []);
```

**Podría ser más simple** con `refetchInterval` de React Query

---

## 3.3 Countdown Hook (useCountdown)

- **¿Se usa?** Revisar si es necesario o puede simplificarse

---

# 🔴 PARTE 4: SERVICIOS (Fragmentación)

## 4.1 Auth Services (6 servicios)

```
modules/auth/api/services/
  ├── aimharder-auth.service.ts (308 líneas)
  ├── aimharder-refresh.service.ts (204 líneas)
  ├── auth.service.ts (130 líneas) ← WRAPPER INÚTIL
  ├── supabase-session.service.ts (361 líneas) ← MEGA-CLASE
  ├── cookie.service.ts
  └── html-parser.service.ts
```

**Problema**: Responsabilidades fragmentadas, difícil navegar

**Propuesta**: 3 servicios cohesivos
```
auth/
  ├── aimharder-client.service.ts  // Login, refresh, cookies, HTML parsing
  ├── session.service.ts            // Supabase CRUD
  └── auth.utils.ts                 // Cookie helpers, validaciones
```

---

## 4.2 Booking Service (344 líneas)

### Estructura:
```typescript
class BookingService {
  async getBookings() // GET bookings
  async createBooking() // POST booking
  async cancelBooking() // DELETE booking

  // Helpers privados
  private buildBookingUrl()
  private formatCookies()
  private handleBookingResponse()
}
```

**OK**, pero podría usar utils compartidos para:
- `formatCookies()` (duplicado en otros servicios)
- Error handling

---

## 4.3 Prebooking Service (392 líneas)

### Problemas:

#### Métodos muy similares:
```typescript
async updateStatus(input) { /* ... */ }
async markCompleted(id, result) { /* ... */ }
async markFailed(id, errorMessage, result) { /* ... */ }
```

**Solución**: Consolidar en un solo `updateStatus` genérico

#### Queries repetitivas:
```typescript
async findPendingInTimeRange(startTime, endTime) {
  const { data, error } = await this.supabase
    .from("prebookings")
    .select("*")
    .eq("status", "pending")
    // ...
}

async findReadyToExecute(now) {
  const { data, error } = await this.supabase
    .from("prebookings")
    .select("*")
    .eq("status", "pending")  // DUPLICADO
    // ...
}
```

---

## 4.4 Box Services (3 servicios fragmentados)

```
boxes/api/services/
  ├── box.service.ts (165 líneas) - CRUD
  ├── box-detection.service.ts - Parsing HTML
  └── box-access.service.ts - Validación
```

**Solución**: Consolidar en uno o dos servicios

---

# 🔴 PARTE 5: UTILS & MAPPERS

## 5.1 Duplicación de utils

```
lib/utils.ts          ← DUPLICADO
common/lib/utils.ts   ← DUPLICADO
```
**Mismo código, función `cn()`**

## 5.2 Mappers con lógica no-mapping

```typescript
// booking.mapper.ts
private static extractAvailabilityDate(errorMessage?: string) // ❌ PARSING
private static extractDateFromDescription(description: string) // ❌ PARSING
```

**Solución**: Mover a utils

---

# 🔴 PARTE 6: MEGA-COMPONENTES

## 6.1 booking-dashboard.component.tsx (568 líneas)

### Problemas:
- Mezcla UI + lógica + estado
- Muchos sub-componentes inline
- Difícil de leer y mantener

**Solución**: Segregar en componentes más pequeños

---

# ⚫ PARTE 7: CÓDIGO MUERTO / TECH DEBT

## 7.1 Console.logs en producción (8 archivos)

```typescript
// Ejemplos:
console.log("[HYBRID ${executionId}] Triggered...");
console.log("[PreBookingScheduler] Starting...");
console.warn("Missing required cookies:", ...);
console.error("Aimharder auth error:", ...);
```

**Solución**: Sistema de logging estructurado

## 7.2 Variables no usadas

```typescript
// useBookingContext.hook.tsx
interface BookingState {
  aimHarderCurrentDate: string | null;  // ❌ NUNCA SE SETEA
}
```

## 7.3 Métodos probablemente no usados

```typescript
// auth.service.ts
getCookieValue(name: string) // ¿Quién lo usa?
getAimharderCookies() // ¿Quién lo usa?

// booking.business.ts
getCacheStats() // ¿Se usa?
```

---

# 📋 RESUMEN DE VIOLACIONES

## DRY (Don't Repeat Yourself):
- ❌ `lib/utils.ts` vs `common/lib/utils.ts`
- ❌ CORS headers en 10+ routes
- ❌ User validation en 8+ routes
- ❌ Triple sistema de caché (booking)
- ❌ `formatCookies()` duplicado en servicios
- ❌ Lógica de retry duplicada

## KISS (Keep It Simple):
- ❌ Capa de Business innecesaria (booking, boxes, prebooking)
- ❌ Doble sistema de hooks (booking)
- ❌ Refs para workarounds
- ❌ Cache manual cuando React Query existe
- ❌ API routes de 485 líneas

## YAGNI (You Aren't Gonna Need It):
- ❌ BookingBusinessConfig nunca modificado
- ❌ AuthService.logout() vacío
- ❌ Métodos "por si acaso" no usados
- ❌ Estado `aimHarderCurrentDate` nunca seteado
- ❌ Múltiples servicios fragmentados

---

# 🎯 PLAN DE REFACTORIZACIÓN PROPUESTO

## FASE 1: Eliminar Capas Innecesarias
1. ✅ Eliminar `modules/*/business/*.business.ts` (3 archivos)
2. ✅ Eliminar `lib/utils.ts` (duplicado)
3. ✅ Eliminar `auth.service.ts` (wrapper inútil)

## FASE 2: Consolidar Servicios
1. ✅ Fusionar 6 auth services → 3 cohesivos
2. ✅ Fusionar 3 box services → 1-2
3. ✅ Simplificar prebooking service

## FASE 3: Simplificar Hooks
1. ✅ Fusionar `useBookingContext` + `useBooking` → `useBookingsQuery` (React Query)
2. ✅ Simplificar `useTokenRefresh` con React Query
3. ✅ Eliminar hooks no usados

## FASE 4: Refactorizar API Routes
1. ✅ Extraer CORS a utils compartidos
2. ✅ Extraer auth validation a middleware
3. ✅ Mover lógica de negocio a services
4. ✅ Reducir booking route de 485 → ~150 líneas

## FASE 5: Limpiar Tech Debt
1. ✅ Sistema de logging estructurado
2. ✅ Eliminar variables/métodos no usados
3. ✅ Eliminar console.logs

## FASE 6: Segregar Componentes
1. ✅ Split booking-dashboard (568 → 200-300 líneas)
2. ✅ Componentes más pequeños y reutilizables

---

# 📊 REDUCCIÓN ESPERADA

## Antes:
- **112 archivos TS/TSX**
- **~11,702 líneas de código**
- **Complejidad ciclomática alta**
- **Duplicación: ~25%**

## Después (estimado):
- **~85 archivos** (-27 archivos)
- **~7,500 líneas** (-36% código)
- **Complejidad reducida 50%**
- **Duplicación: <5%**

---

# ✅ BENEFICIOS

1. **Mantenibilidad**: Código más fácil de entender y modificar
2. **Performance**: Menos bundle size, menos re-renders
3. **Testing**: Componentes más pequeños, más fáciles de testear
4. **Onboarding**: Nuevos devs entienden el código más rápido
5. **Debugging**: Menos capas = más fácil encontrar bugs
6. **Escalabilidad**: Base sólida para nuevas features

---

**SIGUIENTE PASO**: Esperar aprobación del usuario para empezar la refactorización.

---

# 🏗️ NEXTJS-ARCHITECT REVIEW - 2025-10-03

## Review Status: COMPLETE ✅

### Overall Assessment: MIXED CONCERNS ⚠️

The proposed refactoring plan has **valid intentions** but needs **significant modifications** to align with Next.js 15 best practices and App Router architecture.

**Score**: 60/100 - Needs modifications before execution

### Key Findings:

#### ✅ GOOD Recommendations (Keep These):
1. Consolidate auth services (6 → 3)
2. Consolidate box services (3 → 1-2)
3. Migrate to React Query for client-side data fetching
4. Extract CORS headers to centralized utils
5. Remove console.logs and add structured logging
6. Remove duplicate `lib/utils.ts`
7. Split mega-components (booking-dashboard: 568 → 200 lines)

#### ⚠️ CONCERNING Recommendations (Modify These):
1. **Complete elimination of business layer is TOO AGGRESSIVE**
   - Current business layers are over-engineered (manual caching, retry logic)
   - BUT: Next.js 15 needs orchestration layer for complex operations
   - **Recommendation**: TRANSFORM to Server Actions pattern, don't eliminate

2. **Missing Next.js 15 Server Actions pattern**
   - Plan doesn't address modern Next.js data mutation pattern
   - Server Actions should replace business layer for orchestration
   - Better type safety, progressive enhancement, automatic revalidation

3. **Missing Middleware layer**
   - Auth validation duplicated in 8+ routes
   - CORS headers duplicated in 10+ routes
   - **Recommendation**: Create Next.js middleware.ts for centralized handling

4. **No testing strategy during migration**
   - 80% coverage requirement exists
   - No characterization tests before refactoring
   - Risk of breaking existing functionality

5. **Phase order could cause breakage**
   - Eliminating business layer BEFORE creating replacements is risky
   - **Recommendation**: Create new patterns first, migrate incrementally

#### ❌ MISSING from Plan:
1. Server Actions implementation strategy
2. Middleware creation for auth/CORS
3. Testing safety net (characterization tests)
4. Progressive enhancement considerations
5. Server Component vs Client Component guidelines
6. Monitoring/observability during migration

### Critical Architecture Concerns:

#### 1. Business Layer Transformation (Not Elimination)

**Current Problem** (CONFIRMED):
```typescript
// booking.business.ts - Manual caching + retry = over-engineering
class BookingBusiness {
  private cache: Map<...>;  // React Query does this
  async getBookingsForDay() {
    // Manual retry logic (React Query does this)
    for (let attempt = 1; attempt <= 3; attempt++) {...}
  }
}
```

**Wrong Solution**:
```
❌ Delete all business/*.business.ts files
```

**Right Solution**:
```
✅ Transform to Server Actions pattern:

modules/booking/
  ├── actions/              # NEW - Server Actions
  │   ├── create-booking.action.ts
  │   └── cancel-booking.action.ts
  ├── services/             # KEEP - Pure API calls
  │   └── booking.service.ts
  └── hooks/                # NEW - React Query
      └── useBookingsQuery.hook.tsx
```

**Why**: Server Actions are the Next.js 15 recommended pattern for:
- Complex orchestration logic
- Multi-service coordination
- Business rule validation
- Type-safe mutations with automatic revalidation

#### 2. React Query Migration (Fully Supported ✅)

**Current Problem** (CONFIRMED):
```typescript
// Triple caching system:
1. BookingContext.cache (Map)
2. BookingBusiness.cache (Map with timestamps)
3. Manual loading states
// = ~300 lines of manual cache logic
```

**Solution** (AGREED):
```typescript
// useBookingsQuery.hook.tsx (~40 lines with React Query)
export function useBookingsQuery(date: string, boxId: string) {
  return useQuery({
    queryKey: ['bookings', date, boxId],
    queryFn: () => bookingService.getBookings({ day: date, box: boxId }),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
```

**Benefits**:
- Removes 300+ lines of manual logic
- Automatic retry, refetch, background updates
- Better TypeScript support
- Built-in loading/error states

#### 3. Middleware for Auth & CORS (MISSING from plan)

**Current Problem** (CONFIRMED):
```typescript
// Duplicated in EVERY route (10+ files):
const userEmail = request.headers.get("x-user-email") || "alexsbd1@gmail.com";
const session = await SupabaseSessionService.getSession(userEmail);

return NextResponse.json(data, {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  },
});
```

**Solution** (RECOMMENDED):
```typescript
// middleware.ts (root level)
export async function middleware(request: NextRequest) {
  // Centralized auth validation
  const userEmail = request.headers.get('x-user-email');

  if (!userEmail && request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Add CORS headers automatically
  const response = NextResponse.next();
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*'],
};
```

### Recommended Phase Order (MODIFIED):

**Original Plan** (RISKY):
```
Phase 1: Eliminate business layer ❌
Phase 2: Consolidate services
Phase 3: Simplify hooks
Phase 4: Refactor API routes
```

**Modified Plan** (SAFER):
```
Phase 0: Preparation (1-2 days)
  ✓ Write characterization tests
  ✓ Document current API contracts
  ✓ Setup error tracking

Phase 1: Infrastructure (2-3 days)
  ✓ Create middleware.ts (auth + CORS)
  ✓ Create CORS utils
  ✓ Setup React Query provider
  ✓ Create Server Action pattern template

Phase 2: Booking Module Migration (3-4 days)
  ✓ Create booking/actions/ (Server Actions)
  ✓ Create booking/hooks/ (React Query)
  ✓ Update routes to delegate to Server Actions
  ✓ Test thoroughly
  ✓ Remove old booking.business.ts (only after verification)

Phase 3: Auth Services Consolidation (2 days)
  ✓ Merge 6 auth services → 3
  ✓ Update all imports
  ✓ Test auth flows

Phase 4: Prebooking & Boxes Migration (2-3 days)
  ✓ Apply same pattern as booking
  ✓ Create Server Actions
  ✓ Create React Query hooks

Phase 5: Cleanup (1-2 days)
  ✓ Remove console.logs
  ✓ Remove unused code
  ✓ Update documentation

Phase 6: Component Refactoring (2 days)
  ✓ Split mega-components
  ✓ Extract reusable pieces

Total: 12-18 days (with testing)
```

### Questions for User (Need Clarification):

1. **Server Actions vs API Routes**: Use Server Actions for mutations, or stick with API routes?
   - Recommendation: Server Actions for internal, API routes for external access

2. **Backwards Compatibility**: Need to maintain current API endpoints?
   - If YES: Keep API routes as thin wrappers
   - If NO: Migrate directly to Server Actions

3. **Authentication Strategy**: Continue with custom `x-user-email` header?
   - Recommendation: Migrate to standard auth library (NextAuth.js)

4. **Real-time Updates**: Need real-time booking updates?
   - If YES: Supabase real-time + React Query
   - If NO: Standard React Query refetch

5. **Migration Approach**: Can you afford downtime?
   - If YES: Big-bang migration possible
   - If NO: Need feature flags + gradual rollout

6. **Testing Coverage**: Maintain 80% coverage at each phase?
   - Recommendation: YES, with characterization tests first

### Detailed Analysis Location:

📄 **Full architectural analysis and code examples**:
`/Users/marcosga/Documents/projects/alex/aimharder-wod-bot2/.claude/doc/code_cleanup/nextjs_architect.md`

### Next Steps:

1. ✅ Read detailed analysis document
2. ⏳ Answer clarification questions
3. ⏳ Get approval for modified plan
4. ⏳ Start with Phase 0 (testing safety net)
5. ⏳ Execute incrementally (one module at a time)

### Final Recommendation:

**DO NOT proceed with original plan as-is.**

Use the modified plan that:
- ✅ Transforms business layer to Server Actions (don't eliminate)
- ✅ Adds middleware for auth/CORS centralization
- ✅ Includes testing safety net
- ✅ Migrates incrementally (safer)
- ✅ Aligns with Next.js 15 best practices

---

**Agent**: nextjs-architect
**Status**: Review complete, awaiting user approval of modified plan
**Risk Level**: MEDIUM-HIGH with original plan, LOW-MEDIUM with modified plan


---

# 🧪 FRONTEND TEST ENGINEER REVIEW - 2025-10-03

## Review Status: TESTING STRATEGY COMPLETE ✅

### Overall Assessment: COMPREHENSIVE SAFETY NET ✅

A detailed testing strategy has been created to ensure **ZERO BEHAVIOR CHANGES** during the refactoring process. The strategy prioritizes characterization testing (capturing current behavior) and incremental validation.

**Score**: 95/100 - Comprehensive and ready for execution

### Key Deliverables:

#### ✅ Pre-Refactoring Test Strategy:
1. Characterization tests for all modules (Auth, Booking, Prebooking, Boxes)
2. Coverage goals: 80% minimum (Services: 90%, Utils: 95%, Business: 85%, Components: 70%)
3. Snapshot testing for complex transformations
4. Test data fixtures for consistent testing

#### ✅ Test Categories Defined:
1. **Unit Tests** (Services, Utils, Mappers)
   - Template provided for service testing
   - Template provided for utils testing
   - Template provided for mapper testing with snapshots
2. **Integration Tests** (Hooks, Contexts, Server Actions)
   - React Query hook testing patterns
   - Mutation hook testing patterns
   - Context testing (pre-refactoring)
3. **E2E Tests** (Critical User Flows)
   - Login → Dashboard → Booking flow
   - Early booking → Prebooking creation flow
   - Error handling flows
4. **Visual Regression Tests** (UI Preservation)
   - Snapshot testing for all components
   - STRICT constraint: NO UI changes allowed

#### ✅ Refactoring Safety Net:
1. **Test-Driven Refactoring (TDR) Process**
   - Write tests BEFORE refactoring
   - Run OLD tests against NEW code
   - Parallel implementation strategy (old + new coexist)
2. **Parity Testing**
   - OLD vs NEW behavior validation
   - Ensures 100% feature parity
3. **Snapshot Strategy**
   - Data transformations (mappers)
   - Complex business logic outputs
   - Component render outputs

#### ✅ Test Migration Strategy:
1. **Business Layer → Server Actions**
   - Migration pattern provided
   - Test conversion examples
2. **Manual Hooks → React Query**
   - Hook testing with React Query
   - Cache behavior validation
3. **Service Consolidation**
   - Test migration checklist
   - Import update strategy

#### ✅ CI/CD Integration:
1. **Merge Blockers Defined**:
   - Linting must pass
   - Type checking must pass
   - Unit tests must pass (80% coverage)
   - Integration tests must pass
   - E2E tests must pass
   - Visual snapshots must match
2. **Coverage Thresholds**:
   - Lines: 80%
   - Functions: 80%
   - Branches: 75%
   - Statements: 80%
3. **Test Execution Order**:
   - Lint → Type Check → Unit → Integration → E2E
   - Fast feedback loop

#### ✅ Phase-Specific Testing Requirements:

**Phase 0: Preparation** (BEFORE refactoring)
- Characterization tests for ALL modules
- Service unit tests (90% coverage)
- Utils unit tests (95% coverage)
- E2E tests for critical flows
- Baseline snapshots

**Phase 1: Infrastructure** (Middleware, React Query, Server Actions)
- Middleware tests
- React Query configuration tests
- Server Action template tests
- Regression suite

**Phase 2: Booking Module Migration**
- Server Action tests
- React Query hook tests
- **CRITICAL**: Parity tests (OLD vs NEW)
- E2E validation

**Phase 3-6**: Similar patterns for other modules + cleanup

#### ✅ Testing Tools & Setup:
1. Vitest configuration (main + unit + integration + e2e)
2. Testing Library setup
3. Mock Service Worker (MSW) for API mocking
4. Custom test utilities (render with providers)
5. Test fixtures organization

#### ✅ Metrics & Monitoring:
1. Coverage badge integration
2. Test execution time tracking
3. Flaky test detection script
4. Performance regression tracking

### Critical Success Criteria:

**MUST DO**:
- ✅ Write characterization tests BEFORE any refactoring
- ✅ Maintain 80% coverage at ALL phases
- ✅ Run full test suite before merging each phase
- ✅ NO UI changes (validate with visual snapshots)
- ✅ Parity tests for OLD vs NEW implementations

**MUST NOT DO**:
- ❌ Delete old code before NEW code is tested
- ❌ Update snapshots without review
- ❌ Skip tests "temporarily"
- ❌ Merge with failing tests
- ❌ Change UI during refactoring

### Questions for User (Need Clarification):

1. **Testing Infrastructure**: Does the project have ANY existing tests?
2. **CI/CD Pipeline**: Is GitHub Actions already set up?
3. **Test Database**: Separate Supabase project for testing?
4. **Current Coverage**: What's the baseline coverage?
5. **Critical Flows**: Which user flows are non-negotiable?
6. **Downtime**: Can you afford downtime during migration?
7. **Timeline**: What's the refactoring timeline?
8. **UI Constraints**: Is "NO UI CHANGES" absolute?
9. **Accessibility**: Any WCAG requirements?
10. **External Services**: How to mock Aimharder, Supabase, QStash?

### Detailed Testing Strategy Location:

📄 **Full testing strategy document**:
`/Users/marcosga/Documents/projects/alex/aimharder-wod-bot2/.claude/doc/code_cleanup/frontend-test-engineer.md`

### Next Steps:

1. ✅ Read testing strategy document
2. ⏳ Answer clarification questions
3. ⏳ Get approval for testing approach
4. ⏳ Install testing dependencies
5. ⏳ Write Phase 0 characterization tests
6. ⏳ Set up CI/CD pipeline
7. ⏳ Execute refactoring incrementally with test coverage

### Final Recommendation:

**PROCEED with testing strategy as outlined.**

This strategy ensures:
- ✅ Zero behavior changes during refactoring
- ✅ 80% coverage maintained throughout
- ✅ No UI/UX changes
- ✅ Incremental validation reduces risk
- ✅ CI/CD gates prevent regressions

**Risk Level**: LOW (with comprehensive testing strategy)

---

**Agent**: frontend-test-engineer
**Status**: Testing strategy complete, awaiting user answers to clarification questions
**Document Created**: `.claude/doc/code_cleanup/frontend-test-engineer.md`

