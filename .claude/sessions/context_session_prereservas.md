# Context Session: Sistema de Prereservas

## Objetivo
Implementar un mecanismo de prereservas que permita al backend reservar automáticamente clases cuando se detecta el error `ERROR_EARLY_BOOKING` (-12). El sistema debe identificar el momento exacto en que la clase estará disponible y ejecutar la reserva automáticamente.

⚠️ **CRÍTICO**: Las clases se llenan en 1-10 segundos. El sistema debe preparar todo con anticipación para garantizar ejecución instantánea.

## Análisis Inicial

### Estado Actual del Sistema
El sistema de reservas actual tiene:

1. **Detección de error -12**: Ya existe en múltiples lugares:
   - [booking.constants.ts:56](modules/booking/constants/booking.constants.ts#L56): `ERROR_EARLY_BOOKING: -12`
   - [route.ts:150](app/api/booking/route.ts#L150): Manejo del error con respuesta específica
   - [booking.mapper.ts:142](modules/booking/api/mappers/booking.mapper.ts#L142): Detección en el mapper

2. **Estructura de API**:
   - `POST /api/booking`: Crea reservas vía [route.ts](app/api/booking/route.ts)
   - Respuesta incluye: `errorMssg`, `errorMssgLang`, `bookState`
   - Cookies de sesión gestionadas por Supabase

3. **Infraestructura disponible**:
   - Supabase configurado: [.env.local](/.env.local)
   - Sistema de sesiones: `SupabaseSessionService`
   - Arquitectura hexagonal con servicios, mappers y business logic

### Requisitos Funcionales

1. **Detección automática**: Cuando se intenta reservar y se recibe error -12
2. **Cálculo del momento**: Extraer de `errorMssg` cuándo estará disponible
3. **Persistencia**: Guardar prereserva en Supabase con orden FIFO
4. **Pre-carga dinámica**: Cargar prereservas del próximo minuto y crear interval
5. **Ejecución instantánea**: Ejecutar reservas en orden FIFO sin latencia
6. **Notificación**: Informar al usuario del resultado

### Restricciones de Performance & Diseño

**Problema**: Las clases se llenan en 1-10 segundos desde que abren.

**Restricciones**:
- ❌ **NO Redis**: Todo en memoria del proceso Node.js
- ✅ **UN SOLO CRON**: Cada 1 minuto, crea intervals dinámicos
- ✅ **FIFO**: Múltiples prereservas para misma clase ejecutadas en orden
- ✅ **Eficiente**: No sobrecarga con crons de 1 segundo global

**Solución**: Sistema de cron único + intervals dinámicos
1. **Cron cada 1min**: Busca prereservas del próximo minuto
2. **Si hay prereservas**: Carga datos + Crea interval de 1s
3. **Interval temporal**: Se ejecuta hasta el momento exacto
4. **Ejecución FIFO**: Procesa prereservas en orden de creación
5. **Cleanup**: Interval se destruye después de ejecutar

### Arquitectura Propuesta

```
┌─────────────────┐
│   Frontend      │
│  (Intento de    │
│   reserva)      │
└────────┬────────┘
         │ ERROR -12
         ↓
┌─────────────────────────────────────────┐
│  API Route: POST /api/booking           │
│  - Detecta error -12                    │
│  - Extrae timestamp disponible          │
│  - Crea prereserva en DB con order FIFO │
└─────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────┐
│  Supabase: prebookings table            │
│  - user_email                           │
│  - booking_data (JSON)                  │
│  - available_at (timestamp)             │
│  - status: pending/loaded/executing/... │
│  - created_at (para FIFO)               │
└─────────────────────────────────────────┘
         ↑
         │
┌─────────────────────────────────────────┐
│  CRON: Cada 1 minuto                    │
│  /api/cron/prebooking-scheduler         │
│  ─────────────────────────────────────  │
│  1. Query prebookings WHERE:            │
│     - available_at BETWEEN              │
│       NOW + 45s AND NOW + 75s           │
│     - status = 'pending'                │
│     - ORDER BY created_at ASC (FIFO)    │
│                                         │
│  2. Si hay prereservas:                 │
│     - Cargar sesiones en memoria        │
│     - Agrupar por available_at          │
│     - Crear interval de 1s              │
│     - Status → 'loaded'                 │
│                                         │
│  3. Interval verifica cada 1s:          │
│     - Si NOW >= available_at:           │
│       → Ejecutar prereservas FIFO       │
│       → Status → 'completed'/'failed'   │
│       → clearInterval()                 │
└─────────────────────────────────────────┘
```

### Estrategia de Timing con UN SOLO CRON

```
Timeline de ejecución:

T-2min: Prereservas creadas (varios usuarios)
   │    - User A: created_at: 14:58:00
   │    - User B: created_at: 14:58:03
   │    - User C: created_at: 14:58:10
   ↓
T-1min: [CRON ejecuta] Detecta prereservas
   │    - Query: available_at IN (15:00:00)
   │    - Encuentra 3 prereservas (A, B, C)
   │    - Carga sesiones en memoria:
   │      Map<timestamp, PreBooking[]>
   │    - CREA setInterval(checkAndExecute, 1000)
   │    - Status A,B,C → 'loaded'
   ↓
T-45s: Interval activo, verificando cada 1s
   │    console.log("Esperando... faltan 45s")
   ↓
T-30s: Interval verifica
   │    console.log("Esperando... faltan 30s")
   ↓
T-10s: Interval verifica
   │    console.log("Esperando... faltan 10s")
   ↓
T-1s:  Interval verifica
   │    console.log("Esperando... falta 1s")
   ↓
T-0:   ⚡ EJECUCIÓN FIFO
   │    NOW >= available_at ✓
   │
   │    Ejecuta en orden:
   │    1. User A (14:58:00) → ejecuta primero
   │    2. User B (14:58:03) → ejecuta segundo
   │    3. User C (14:58:10) → ejecuta tercero
   │
   │    Cada ejecución:
   │    - Desde memoria (sesión pre-cargada)
   │    - ~10-50ms latencia
   │    - POST directo a AimHarder
   │    - Status → 'completed'
   │
   │    clearInterval(intervalId) ✓
   ↓
T+1s:  Clases reservadas en orden FIFO ✅
   │    User A: reservado en T+0.02s
   │    User B: reservado en T+0.05s
   │    User C: reservado en T+0.08s
```

### Ventajas de este Enfoque

✅ **Eficiencia**: Solo 1 cron cada minuto (no sobrecarga)
✅ **Dinámico**: Intervals solo cuando hay prereservas
✅ **Sin Redis**: Todo en memoria del proceso Node.js
✅ **FIFO**: Orden garantizado por `created_at`
✅ **Cleanup automático**: Intervals se destruyen después de usar
✅ **Escalable**: Cada timestamp tiene su propio interval

### Estructura en Memoria

```typescript
// Singleton en memoria del servidor
class PreBookingScheduler {
  private activeIntervals: Map<number, NodeJS.Timeout> = new Map();
  private loadedBookings: Map<number, LoadedPreBooking[]> = new Map();

  // LoadedPreBooking incluye:
  // - booking_data
  // - cookies (pre-cargadas)
  // - user_email
  // - available_at
  // - created_at (para FIFO)
}

// Estructura:
activeIntervals: {
  1707336000000: <intervalId>, // 15:00:00
  1707337200000: <intervalId>, // 15:20:00
}

loadedBookings: {
  1707336000000: [ // 15:00:00
    {booking_data, cookies, created_at: 1707335880000}, // User A
    {booking_data, cookies, created_at: 1707335883000}, // User B
    {booking_data, cookies, created_at: 1707335890000}, // User C
  ]
}
```

### Tareas Identificadas

#### 1. Base de Datos (Supabase)
```sql
CREATE TABLE prebookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  booking_data JSONB NOT NULL, -- {day, familyId, id, insist}
  available_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending', -- pending/loaded/executing/completed/failed
  result JSONB, -- Resultado de la ejecución
  created_at TIMESTAMPTZ DEFAULT NOW(), -- ⚠️ IMPORTANTE para FIFO
  loaded_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  INDEX idx_available_at_status (available_at, status),
  INDEX idx_created_at (created_at) -- Para ordenamiento FIFO
);
```

#### 2. Backend Services

**`modules/prebooking/business/prebooking-scheduler.business.ts`**
```typescript
class PreBookingScheduler {
  // Singleton pattern
  // Maneja intervals dinámicos
  // Ejecuta prereservas FIFO
}
```

**`modules/prebooking/api/services/prebooking.service.ts`**
```typescript
class PreBookingService {
  async create(data): Promise<PreBooking>
  async findPendingInTimeRange(start, end): Promise<PreBooking[]>
  async updateStatus(id, status): Promise<void>
  async listByUser(email): Promise<PreBooking[]>
}
```

**`modules/prebooking/utils/error-parser.utils.ts`**
```typescript
// Parsea errorMssg de AimHarder
// Extrae timestamp exacto
parseEarlyBookingError(errorMssg: string): Date
```

#### 3. API Routes

**`app/api/prebooking/route.ts`**
- `POST`: Crear prereserva cuando error -12
- `GET`: Listar prereservas del usuario
- `DELETE`: Cancelar prereserva

**`app/api/cron/prebooking-scheduler/route.ts`**
- Ejecuta cada 1 minuto (Vercel Cron)
- Query prereservas del próximo minuto
- Carga en memoria + Crea intervals
- Ejecuta FIFO cuando llega el momento

#### 4. Vercel Cron Configuration
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/prebooking-scheduler",
      "schedule": "* * * * *" // Cada 1 minuto
    }
  ]
}
```

#### 5. Frontend

**Hook**: `modules/prebooking/pods/prebooking/hooks/usePreBooking.hook.ts`
```typescript
const usePreBooking = () => {
  const createPreBooking = async (bookingData, availableAt) => {...}
  const listPreBookings = async () => {...}
  const cancelPreBooking = async (id) => {...}
}
```

**UI**: Badge mostrando prereservas activas
```tsx
{hasActivePreBooking && (
  <Badge>
    Prereserva activa para {className} - {formatDate(availableAt)}
  </Badge>
)}
```

#### 6. Integración con Flujo Actual

Modificar `app/api/booking/route.ts` línea 150:
```typescript
} else if (bookingResponse.bookState === BOOKING_CONSTANTS.BOOKING_STATES.ERROR_EARLY_BOOKING) {
  // Parse timestamp from errorMssg
  const availableAt = parseEarlyBookingError(bookingResponse.errorMssg);

  // Create prebooking automatically
  await prebookingService.create({
    user_email: userEmail,
    booking_data: validatedRequest.data,
    available_at: availableAt,
  });

  return NextResponse.json({
    success: false,
    error: "early_booking",
    message: bookingResponse.errorMssg,
    prebookingCreated: true, // ✅ Indica que se creó prereserva
    availableAt: availableAt.toISOString(),
  });
}
```

### Ejemplo de Flujo Completo

**Escenario**: 5 usuarios intentan reservar la misma clase del lunes 18:00

**Lunes 12:00 - Usuarios intentan reservar**
```
User A (12:00:10) → ERROR -12 → Prereserva #1
User B (12:00:15) → ERROR -12 → Prereserva #2
User C (12:00:25) → ERROR -12 → Prereserva #3
User D (12:05:00) → ERROR -12 → Prereserva #4
User E (12:10:00) → ERROR -12 → Prereserva #5

DB state:
- Todas con available_at: "Viernes 20:00:00"
- Ordenadas por created_at (FIFO)
```

**Viernes 19:59:00 - Cron ejecuta**
```typescript
// Query: WHERE available_at BETWEEN 19:59:45 AND 20:00:15
// Resultado: 5 prereservas ordenadas por created_at ASC

scheduler.loadBookings([prebooking1, 2, 3, 4, 5]);
// Carga sesiones de todos los usuarios
// Crea interval de 1s

intervalId = setInterval(() => {
  if (Date.now() >= targetTimestamp) {
    executeBookingsFIFO(); // Ejecuta en orden
    clearInterval(intervalId);
  }
}, 1000);
```

**Viernes 20:00:00.001 - Ejecución FIFO**
```
20:00:00.010 → User A ejecuta (primero)
20:00:00.050 → User B ejecuta (segundo)
20:00:00.090 → User C ejecuta (tercero)
20:00:00.130 → User D ejecuta (cuarto) ⚠️ Clase llena
20:00:00.170 → User E ejecuta (quinto) ⚠️ Clase llena

Resultado:
- User A: ✅ Reservado (llegó primero)
- User B: ✅ Reservado (llegó segundo)
- User C: ✅ Reservado (llegó tercero)
- User D: ❌ Clase llena (llegó cuarto, pero clase tenía 3 plazas)
- User E: ❌ Clase llena
```

## Consulta a Subagentes

Necesitamos opinión de:

1. **nextjs-architect**:
   - Vercel Cron cada 1 minuto + intervals dinámicos
   - Singleton pattern para scheduler en memoria
   - Edge cases: redeploy, timeout, múltiples instancias

2. **frontend-developer**:
   - Integrar prereservas en flujo actual
   - UX para mostrar prereservas activas
   - Manejo de respuesta cuando se crea prereserva automáticamente

3. **general-purpose**:
   - Research parseo de `errorMssg` de AimHarder
   - Formatos típicos de mensajes de error
   - Extracción de timestamps

## Decisión Final: GitHub Actions + Vercel API

### Arquitectura Confirmada

**GitHub Actions** ejecuta cada 1 minuto y llama a la API de Vercel:
- Timeout: 5 minutos
- Mantiene conexión abierta
- Espera respuesta completa
- Logs detallados en GitHub

**Vercel API** (`/api/cron/prebooking-scheduler`):
- Recibe request de GitHub Actions
- Carga prereservas del próximo minuto en memoria
- Crea `setInterval()` cada 1 segundo
- Ejecuta prereservas FIFO cuando llega el momento
- Responde a GitHub Actions cuando termina

### Ventajas de este Approach
✅ GitHub Actions NO tiene límite de 10s (puede esperar minutos)
✅ Vercel API puede usar `setInterval()` porque GH Actions mantiene conexión
✅ Gratis (2000 min/mes en repos privados)
✅ Precisión de ~1 segundo
✅ Todo en memoria (sin Redis)
✅ FIFO garantizado por created_at

---

## Implementación Completada

### Backend ✅

**1. Base de Datos**
- ✅ [supabase/migrations/001_create_prebookings_table.sql](supabase/migrations/001_create_prebookings_table.sql)
  - Tabla `prebookings` con índices optimizados
  - Columnas: id, user_email, booking_data, available_at, status, result, etc.
  - Índices para queries eficientes (FIFO, status, user)

**2. Modelos y Types**
- ✅ [modules/prebooking/models/prebooking.model.ts](modules/prebooking/models/prebooking.model.ts)
- ✅ [modules/prebooking/api/models/prebooking.api.ts](modules/prebooking/api/models/prebooking.api.ts)
- ✅ [modules/prebooking/api/mappers/prebooking.mapper.ts](modules/prebooking/api/mappers/prebooking.mapper.ts)

**3. Services**
- ✅ [modules/prebooking/api/services/prebooking.service.ts](modules/prebooking/api/services/prebooking.service.ts)
  - CRUD completo para prereservas
  - Query por rango de tiempo para FIFO
  - Actualización de status

**4. Utils**
- ✅ [modules/prebooking/utils/error-parser.utils.ts](modules/prebooking/utils/error-parser.utils.ts)
  - Parser de mensajes de error de AimHarder
  - Cálculo exacto de timestamp disponible
  - Helpers para countdown y validación

**5. Business Logic - Scheduler**
- ✅ [modules/prebooking/business/prebooking-scheduler.business.ts](modules/prebooking/business/prebooking-scheduler.business.ts)
  - Singleton pattern
  - Carga prereservas en memoria
  - setInterval dinámico cada 1s
  - Ejecución FIFO
  - Timeout de seguridad 4 min

**6. API Routes**
- ✅ [app/api/cron/prebooking-scheduler/route.ts](app/api/cron/prebooking-scheduler/route.ts)
  - POST: Ejecuta scheduler (llamado por GitHub Actions)
  - GET: Stats para monitoring
  - Autenticación con Bearer token
- ✅ [app/api/prebooking/route.ts](app/api/prebooking/route.ts)
  - GET: Listar prereservas de usuario
  - DELETE: Cancelar prereserva
- ✅ [app/api/booking/route.ts](app/api/booking/route.ts) - MODIFICADO
  - Detecta error -12 automáticamente
  - Crea prereserva usando parser
  - Responde con info de prereserva creada

**7. GitHub Actions**
- ✅ [.github/workflows/prebooking-scheduler.yml](.github/workflows/prebooking-scheduler.yml)
  - Cron cada 1 minuto
  - Llama a API con timeout 5 min
  - Manejo de errores y reporting

**8. Configuración**
- ✅ [.env.example](.env.example) - ACTUALIZADO
  - CRON_SECRET para autenticación
  - Documentación de GitHub Secrets

### Flujo Completo Implementado

```
1. Usuario intenta reservar clase
   ↓
2. POST /api/booking recibe error -12
   ↓
3. Parser extrae timestamp exacto
   ↓
4. Crea prereserva en Supabase (status: pending)
   ↓
5. Responde al usuario con prereserva creada
   ↓

[... tiempo pasa ...]

6. GitHub Actions ejecuta cada 1 min
   ↓
7. POST /api/cron/prebooking-scheduler
   ↓
8. Query: prebookings WHERE available_at IN (now+45s, now+75s)
   ↓
9. Carga en memoria con sesiones de usuario
   ↓
10. Status → 'loaded'
   ↓
11. setInterval cada 1s verifica timestamp
   ↓
12. Cuando NOW >= available_at:
    - Ejecuta prereservas FIFO (por created_at)
    - POST a AimHarder con cookies pre-cargadas
    - Actualiza status → 'completed' o 'failed'
   ↓
13. clearInterval() cuando termina
   ↓
14. Responde a GitHub Actions
```

### Frontend ✅

**1. Hooks**
- ✅ [modules/prebooking/pods/prebooking/hooks/usePreBooking.hook.tsx](modules/prebooking/pods/prebooking/hooks/usePreBooking.hook.tsx)
  - Fetch prereservas del usuario
  - Cancel prereservas
  - Check active prebooking por slot
  - Auto-refresh cada 30s
- ✅ [modules/prebooking/pods/prebooking/hooks/useCountdown.hook.tsx](modules/prebooking/pods/prebooking/hooks/useCountdown.hook.tsx)
  - Countdown dinámico cada 1s
  - Formato legible (días, horas, minutos, segundos)

**2. Componentes UI**
- ✅ [modules/prebooking/pods/prebooking/components/PreBookingBadge.component.tsx](modules/prebooking/pods/prebooking/components/PreBookingBadge.component.tsx)
  - Badge con countdown en tiempo real
  - Estados visuales (pending, loaded, executing, completed, failed)
  - Versión compacta y detallada
  - Animaciones para estados loading

**3. Integración en Dashboard**
- ✅ [booking-dashboard.component.tsx](modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx) - MODIFICADO
  - Integrado hook usePreBooking
  - Detección de respuesta con prebooking
  - Alert de confirmación con fecha formateada
  - Card de resumen de prereservas activas
  - Auto-refresh de prereservas después de crear

- ✅ [booking-grid.component.tsx](modules/booking/pods/booking-dashboard/components/booking-grid/booking-grid.component.tsx) - MODIFICADO
  - Pasa prereservas a cada card
  - Helper para buscar prebooking por slot

- ✅ [booking-card.component.tsx](modules/booking/pods/booking-dashboard/components/booking-card/booking-card.component.tsx) - MODIFICADO
  - Muestra PreBookingBadge cuando existe prereserva
  - Badge integrado en el contenido de la card

### Pasos para Deployment

1. **Supabase**:
   ```bash
   # Ejecutar migración
   psql $DATABASE_URL < supabase/migrations/001_create_prebookings_table.sql
   ```

2. **GitHub Secrets**:
   ```
   APP_URL=https://tu-app.vercel.app
   CRON_SECRET=<genera con: openssl rand -base64 32>
   ```

3. **Variables de Entorno en Vercel**:
   ```
   CRON_SECRET=<mismo valor que GitHub Secret>
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

4. **Activar GitHub Actions**:
   - El workflow se activa automáticamente cada minuto
   - Para testing manual: Actions → PreBooking Scheduler → Run workflow

## Flujo de Usuario Completo

### Escenario: Usuario intenta reservar clase

```
1. Usuario hace clic en "Reservar" en clase del viernes 20:00
   ↓
2. Backend detecta error -12: "No puedes reservar con más de 4 días"
   ↓
3. Backend parsea automáticamente → disponible: Lunes 00:00
   ↓
4. Backend crea prereserva en DB
   ↓
5. Frontend muestra alert:
   "✅ Prereserva creada!
   Se reservará automáticamente el lun., 10 feb., 00:00
   No puedes reservar clases con más de 4 días de antelación"
   ↓
6. Card de la clase muestra badge azul:
   "Prereserva activa
   Se reservará en: 2d 5h"
   ↓
7. Badge se actualiza cada segundo:
   "Se reservará en: 1d 23h"
   "Se reservará en: 5h 32m"
   "Se reservará en: 45m 12s"
   "Se reservará en: 10s"
   ↓
8. Lunes 00:00:00 - GitHub Actions ejecuta
   ↓
9. Backend carga prereserva en memoria
   Badge cambia: "Preparando..." (spinning icon)
   ↓
10. Backend ejecuta reserva
    Badge cambia: "Ejecutando" (spinning icon)
   ↓
11. Reserva exitosa
    Badge cambia: "Reservado ✓" (verde)
    Card muestra "Cancelar" button
```

---

**Status**: ✅ COMPLETADO - Backend + Frontend + UX Improvements
**Tiempo de implementación**:
- Backend: ~2 horas
- Frontend: ~1 hora
- UX Improvements: ~30 min
- **Total: ~3.5 horas**

**Decisiones clave**:
- ✅ GitHub Actions como trigger (cada 1 min)
- ✅ Vercel API maneja setInterval dinámico
- ✅ Todo en memoria (sin Redis)
- ✅ FIFO garantizado por created_at
- ✅ Timeout de seguridad 4 min
- ✅ Detección automática de error -12
- ✅ Parser robusto de mensajes de error que preserva la hora de clase
- ✅ UI integrada con countdown en tiempo real
- ✅ Auto-refresh de prereservas cada 30s
- ✅ Mensaje de éxito al crear prereserva (no error)
- ✅ Botón "Cancelar Prereserva" en lugar de "Reservar" cuando existe prereserva activa
- ✅ Handler completo para cancelación de prereservas

---

## Mejoras UX Finales Implementadas ✅

### 1. Cálculo correcto de tiempo disponible
**Problema**: Si una clase es viernes 20:30 con 4 días de antelación, el sistema calculaba lunes 00:00.

**Solución**: ✅ [error-parser.utils.ts:34-42](modules/prebooking/utils/error-parser.utils.ts#L34)
- Parser ahora acepta parámetro `classTime`
- Extrae hora y minutos de la clase
- Calcula fecha disponible preservando la hora exacta
- Ejemplo: Viernes 20:30 - 4 días = Lunes 20:30 ✓

**Integración**: ✅ [booking-dashboard.component.tsx:82](modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx#L82)
- Extrae `classTime` del booking antes de enviar
- Pasa `classTime` en request body
- Backend usa `classTime` en el parser

### 2. Mensaje de éxito al crear prereserva
**Problema**: Al crear prereserva se mostraba como error confuso para el usuario.

**Solución**: ✅ [booking-dashboard.component.tsx:162-164](modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx#L162)
```typescript
alert(
  `✅ ¡Prereserva creada exitosamente!\n\n📅 Se reservará automáticamente el ${formattedDate}\n\nLa reserva se ejecutará cuando se abra el período de reservas.`
);
```
- Mensaje positivo con emoji de éxito ✅
- Fecha formateada en español (lun., 10 feb., 20:30)
- Explica claramente qué pasará
- No muestra como error

### 3. Botón "Cancelar Prereserva" cuando existe prereserva activa
**Problema**: Usuario veía "Reservar" incluso cuando ya tenía prereserva activa, confuso y podría crear duplicados.

**Solución**: ✅ [booking-card.component.tsx:51-82](modules/booking/pods/booking-dashboard/components/booking-card/booking-card.component.tsx#L51)
- Detecta si existe prereserva activa (pending o loaded)
- Cambia botón a "Cancelar Prereserva" (naranja)
- Deshabilita botón "Reservar" completamente
- Estado de loading durante cancelación

**Handler de cancelación**: ✅ [booking-dashboard.component.tsx:285-331](modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx#L285)
```typescript
const handleCancelPrebooking = useCallback(async (prebookingId: string) => {
  // Confirma con usuario
  // Llama DELETE /api/prebooking?id={id}
  // Muestra mensaje de éxito
  // Refresca lista de prereservas
}, [fetchPrebookings, refetch]);
```

**Props propagadas**: ✅ Todos los componentes actualizados
- [booking-card.component.tsx:25-32](modules/booking/pods/booking-dashboard/components/booking-card/booking-card.component.tsx#L25): Añadidas props `onCancelPrebooking` e `isCancellingPrebooking`
- [booking-grid.component.tsx:15-23](modules/booking/pods/booking-dashboard/components/booking-grid/booking-grid.component.tsx#L15): Propagadas props
- [booking-dashboard.component.tsx:482](modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx#L482): Handler conectado

### 4. Estados visuales claros
- ✅ **Prereserva pendiente**: Badge azul con countdown
- ✅ **Prereserva cargada**: Badge verde "Preparando..."
- ✅ **Durante ejecución**: Badge amarillo "Ejecutando" con spinner
- ✅ **Botón activo**: Naranja "Cancelar Prereserva" (reemplaza "Reservar")
- ✅ **Botón loading**: "Cancelando..." con disabled state

### Flujo completo actualizado:
```
1. Usuario hace clic en "Reservar" → Error -12
   ↓
2. ✅ Alert positivo: "¡Prereserva creada exitosamente!"
   "📅 Se reservará automáticamente el lun., 10 feb., 20:30"
   ↓
3. Badge muestra: "Prereserva activa - Se reservará en: 2d 5h"
   ↓
4. ✅ Botón cambia a: "Cancelar Prereserva" (naranja)
   ↓
5. Usuario puede cancelar si cambia de opinión
   ↓
6. Al cancelar: "¿Estás seguro?" → DELETE API → "✅ Prereserva cancelada!"
   ↓
7. Botón vuelve a: "Reservar"
```

**Archivos modificados en esta fase**:
- ✅ [modules/prebooking/utils/error-parser.utils.ts](modules/prebooking/utils/error-parser.utils.ts) - Parser con classTime
- ✅ [modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx](modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx) - Mensajes, handlers
- ✅ [modules/booking/pods/booking-dashboard/components/booking-card/booking-card.component.tsx](modules/booking/pods/booking-dashboard/components/booking-card/booking-card.component.tsx) - Botón cancelar
- ✅ [modules/booking/pods/booking-dashboard/components/booking-grid/booking-grid.component.tsx](modules/booking/pods/booking-dashboard/components/booking-grid/booking-grid.component.tsx) - Props
- ✅ [app/api/booking/route.ts](app/api/booking/route.ts) - Extracción classTime
- ✅ [app/api/prebooking/route.ts](app/api/prebooking/route.ts) - DELETE ya existía ✓