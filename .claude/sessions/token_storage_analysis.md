# Análisis: Almacenamiento de Refresh Tokens

**Fecha**: 2025-10-20
**Pregunta**: ¿Estamos guardando los refresh tokens en BBDD además de localStorage?

---

## 📊 Respuesta Corta

✅ **SÍ, estamos guardando los refresh tokens en AMBOS lugares:**

1. **Base de Datos (Supabase)** → Almacenamiento persistente, source of truth
2. **localStorage (Browser)** → Cache local para acceso rápido del frontend

---

## 🗄️ Almacenamiento en Base de Datos

### Tabla: `auth_sessions`

**Esquema**:
```sql
CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY,
  user_email VARCHAR NOT NULL,
  fingerprint VARCHAR NOT NULL,
  session_type VARCHAR NOT NULL, -- 'device' | 'background'

  -- 🔑 REFRESH TOKEN (guardado en DB)
  aimharder_token VARCHAR NOT NULL,

  -- 🍪 COOKIES (guardadas en DB)
  aimharder_cookies JSONB,

  -- Metadata
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  last_token_update_date TIMESTAMP,
  token_update_count INTEGER,

  -- Composite key
  UNIQUE(user_email, fingerprint)
);
```

### Datos Guardados

**Por cada sesión (device o background)**:
```typescript
{
  user_email: "alex@example.com",
  fingerprint: "dev-abc123...",
  session_type: "device",

  // ✅ REFRESH TOKEN guardado en BBDD
  aimharder_token: "AQHhPfTHxxxxxxxxxxx",

  // ✅ COOKIES guardadas en BBDD
  aimharder_cookies: [
    { name: "JSESSIONID", value: "xxx" },
    { name: "cookiesession1", value: "xxx" },
    { name: "UserAuthToken", value: "xxx" },
    // ... más cookies
  ],

  created_at: "2025-10-20T10:00:00Z",
  updated_at: "2025-10-20T10:30:00Z",
  last_token_update_date: "2025-10-20T10:30:00Z",
  token_update_count: 3
}
```

---

## 💾 Almacenamiento en localStorage

### Navegador (Frontend)

**localStorage keys**:
```typescript
localStorage.setItem("user-email", "alex@example.com");
localStorage.setItem("fingerprint", "dev-abc123...");

// ✅ REFRESH TOKEN guardado en localStorage
localStorage.setItem("refreshToken", "AQHhPfTHxxxxxxxxxxx");
```

**NOTA**: Las cookies NO se guardan en localStorage, solo el refreshToken.

---

## 🔄 Flujo Completo: Token Refresh

### 1. Login Inicial

**Usuario hace login**:
```typescript
// Backend: modules/auth/api/services/aimharder-auth.service.ts
const loginResponse = await AimharderAuthService.login(email, password, fingerprint);

// Backend guarda en BBDD
await SupabaseSessionService.storeSession({
  email,
  token: loginResponse.refreshToken,      // ✅ Guardado en DB
  cookies: loginResponse.cookies,          // ✅ Guardado en DB
  fingerprint,
  sessionType: 'device'
});

// Frontend guarda en localStorage
localStorage.setItem("refreshToken", loginResponse.refreshToken);  // ✅ Guardado en localStorage
localStorage.setItem("fingerprint", fingerprint);
localStorage.setItem("user-email", email);
```

**Resultado**:
- ✅ `aimharder_token` en DB = `"AQHhPfTHxxxxxxxxxxx"`
- ✅ `aimharder_cookies` en DB = `[{...}, {...}]`
- ✅ `localStorage.refreshToken` = `"AQHhPfTHxxxxxxxxxxx"`

---

### 2. Token Refresh (Frontend cada 10 min)

**Hook ejecuta refresh**:
```typescript
// modules/auth/hooks/useTokenRefresh.hook.tsx

// PASO 1: Lee token actual de localStorage
const token = localStorage.getItem("refreshToken");       // Lee de localStorage
const fingerprint = localStorage.getItem("fingerprint");
const email = localStorage.getItem("user-email");

// PASO 2: Llama API para refrescar
const response = await fetch("/api/auth/token-update", {
  method: "POST",
  body: JSON.stringify({ email, token, fingerprint })
});

const data = await response.json();

// PASO 3: Actualiza localStorage con nuevo token
if (data.newToken) {
  localStorage.setItem("refreshToken", data.newToken);  // ✅ Actualiza localStorage
}
```

**Backend endpoint**:
```typescript
// app/api/auth/token-update/route.ts

// PASO 1: Obtiene sesión de BBDD (para obtener las cookies)
const session = await SupabaseSessionService.getSession(email, { fingerprint });

// PASO 2: Llama a AimHarder para refrescar
const updateResult = await AimharderRefreshService.updateToken({
  token,              // Token del request (de localStorage)
  fingerprint,
  cookies: session.cookies  // Cookies de BBDD
});

// PASO 3: Guarda nuevo token en BBDD
await SupabaseSessionService.updateRefreshToken(
  email,
  updateResult.newToken,  // ✅ Nuevo token guardado en DB
  fingerprint
);

// PASO 4: Actualiza cookies en BBDD
await SupabaseSessionService.updateCookies(
  email,
  updateResult.cookies,   // ✅ Nuevas cookies guardadas en DB
  fingerprint
);

// PASO 5: Retorna nuevo token al frontend
return NextResponse.json({
  success: true,
  newToken: updateResult.newToken  // Frontend lo guardará en localStorage
});
```

**Resultado después del refresh**:
- ✅ DB: `aimharder_token` = `"AQHhPfTHyyyyyyyyyy"` (nuevo)
- ✅ DB: `aimharder_cookies` = `[{...nuevas...}]` (actualizadas)
- ✅ DB: `updated_at` = NOW()
- ✅ localStorage: `refreshToken` = `"AQHhPfTHyyyyyyyyyy"` (nuevo)

---

### 3. Token Refresh (Cron cada 10 min)

**Cron job ejecuta**:
```typescript
// app/api/cron/refresh-tokens/route.ts

// PASO 1: Obtiene TODAS las sesiones de BBDD
const sessions = await SupabaseSessionService.getAllActiveSessions();

// PASO 2: Procesa cada sesión
for (const session of sessions) {
  // Lee token de BBDD (no de localStorage)
  const updateResult = await AimharderRefreshService.updateToken({
    token: session.token,        // ✅ De BBDD
    fingerprint: session.fingerprint,
    cookies: session.cookies     // ✅ De BBDD
  });

  // Guarda nuevo token en BBDD
  await SupabaseSessionService.updateRefreshToken(
    session.email,
    updateResult.newToken,       // ✅ Guardado en DB
    session.fingerprint
  );

  // Actualiza cookies en BBDD
  await SupabaseSessionService.updateCookies(
    session.email,
    updateResult.cookies,        // ✅ Guardado en DB
    session.fingerprint
  );
}
```

**Resultado**:
- ✅ DB: Todas las sesiones actualizadas con nuevos tokens
- ✅ DB: Todas las cookies actualizadas
- ❌ localStorage: NO se actualiza (cron es backend-only)

**NOTA**: El frontend NO sabe que el cron actualizó el token. El frontend seguirá usando su token de localStorage hasta el próximo refresh del hook (10 min).

---

## 🔍 Métodos de Actualización en DB

### `updateRefreshToken()`

**Código**: `modules/auth/api/services/supabase-session.service.ts:361-399`

```typescript
static async updateRefreshToken(
  email: string,
  refreshToken: string,
  fingerprint?: string
): Promise<void> {
  const updateData = {
    aimharder_token: refreshToken,     // ✅ Actualiza el token
    updated_at: new Date().toISOString()  // ✅ Actualiza timestamp
  };

  let query = supabaseAdmin
    .from("auth_sessions")
    .update(updateData)
    .eq("user_email", email);

  // Targetea la sesión específica por fingerprint
  if (fingerprint) {
    query = query.eq("fingerprint", fingerprint);
  } else {
    query = query.eq("session_type", "background");
  }

  await query;
}
```

**Query SQL ejecutado**:
```sql
UPDATE auth_sessions
SET
  aimharder_token = 'AQHhPfTHyyyyyyyyyy',  -- ✅ Nuevo token
  updated_at = '2025-10-20T10:30:00Z'
WHERE
  user_email = 'alex@example.com'
  AND fingerprint = 'dev-abc123';          -- Sesión específica
```

---

### `updateCookies()`

**Código**: `modules/auth/api/services/supabase-session.service.ts:409-450`

```typescript
static async updateCookies(
  email: string,
  cookies: Array<{ name: string; value: string }>,
  fingerprint?: string
): Promise<void> {
  const updateData = {
    aimharder_cookies: cookies.map(c => ({  // ✅ Actualiza cookies
      name: c.name,
      value: c.value
    })),
    updated_at: new Date().toISOString()
  };

  let query = supabaseAdmin
    .from("auth_sessions")
    .update(updateData)
    .eq("user_email", email);

  if (fingerprint) {
    query = query.eq("fingerprint", fingerprint);
  } else {
    query = query.eq("session_type", "background");
  }

  await query;
}
```

**Query SQL ejecutado**:
```sql
UPDATE auth_sessions
SET
  aimharder_cookies = '[
    {"name": "JSESSIONID", "value": "xxx"},
    {"name": "cookiesession1", "value": "yyy"},
    ...
  ]',  -- ✅ Nuevas cookies
  updated_at = '2025-10-20T10:30:00Z'
WHERE
  user_email = 'alex@example.com'
  AND fingerprint = 'dev-abc123';
```

---

## 🔄 Sincronización: DB vs localStorage

### Estrategia Actual

**DB es la fuente de verdad (Source of Truth)**:
- ✅ DB siempre tiene el token más actualizado
- ✅ DB tiene las cookies (localStorage NO las tiene)
- ✅ DB es usado por backend (cron jobs, prebookings)

**localStorage es un cache**:
- ✅ localStorage permite acceso rápido en frontend
- ✅ localStorage NO necesita las cookies (solo el token)
- ⚠️ localStorage puede estar desincronizado temporalmente

### Casos de Desincronización

**Caso 1: Cron actualiza pero frontend no**
```
T+0:  DB token = "v1",  localStorage token = "v1"  ✅ Sincronizados
T+10: Cron ejecuta
      DB token = "v2",  localStorage token = "v1"  ⚠️ Desincronizados
T+12: Frontend refresh ejecuta
      DB token = "v3",  localStorage token = "v3"  ✅ Sincronizados de nuevo
```

**¿Es esto un problema?**
- ❌ NO es un problema
- El token "v1" en localStorage sigue siendo válido por ~30 minutos
- Frontend usa su token "v1" para refrescar y obtiene "v3" (que es incluso más nuevo que "v2")
- DB se actualiza con "v3" (sobrescribe "v2" del cron)

**Caso 2: Usuario abre app después de estar cerrada**
```
T+0:  Usuario cierra app
      DB token = "v5" (cron ha seguido actualizando)
      localStorage token = "v1" (viejo)

T+60: Usuario abre app
      Frontend lee localStorage: "v1"
      Frontend ejecuta refresh con "v1"

      ¿"v1" es válido todavía?
      - Si sí: Obtiene "v6", actualiza localStorage y DB
      - Si no: Logout, redirect a login
```

**¿Es esto un problema?**
- ❌ NO es un problema
- Si el token expiró, frontend detecta y hace logout
- Si el token sigue válido, frontend lo usa y se sincroniza

---

## 📊 Comparación: Original vs Actual

### Sistema Original (Single Session)

```typescript
// BBDD
{
  user_email: "alex@example.com",
  aimharder_token: "v1",          // ✅ Guardado
  aimharder_cookies: [...]        // ✅ Guardado
}

// localStorage
localStorage.refreshToken = "v1"  // ✅ Guardado

// Problema: Una sesión para todo (UI + background)
```

---

### Sistema Actual (Multi-Session)

```typescript
// BBDD - Múltiples sesiones
[
  {
    user_email: "alex@example.com",
    fingerprint: "dev-iphone-abc",
    session_type: "device",
    aimharder_token: "v1",        // ✅ Token del iPhone
    aimharder_cookies: [...]      // ✅ Cookies del iPhone
  },
  {
    user_email: "alex@example.com",
    fingerprint: "dev-ipad-xyz",
    session_type: "device",
    aimharder_token: "v2",        // ✅ Token del iPad
    aimharder_cookies: [...]      // ✅ Cookies del iPad
  },
  {
    user_email: "alex@example.com",
    fingerprint: "bg-hash123",
    session_type: "background",
    aimharder_token: "v3",        // ✅ Token background
    aimharder_cookies: [...]      // ✅ Cookies background
  }
]

// localStorage (iPhone)
localStorage.refreshToken = "v1"         // ✅ Solo el token del iPhone
localStorage.fingerprint = "dev-iphone-abc"

// localStorage (iPad)
localStorage.refreshToken = "v2"         // ✅ Solo el token del iPad
localStorage.fingerprint = "dev-ipad-xyz"

// Ventaja: Cada sesión es independiente
```

---

## ✅ Conclusión

### ¿Qué se guarda y dónde?

| Dato | Base de Datos | localStorage |
|------|---------------|--------------|
| **refreshToken** | ✅ Sí (`aimharder_token`) | ✅ Sí |
| **Cookies** | ✅ Sí (`aimharder_cookies`) | ❌ No |
| **Fingerprint** | ✅ Sí | ✅ Sí |
| **Email** | ✅ Sí | ✅ Sí |
| **Session type** | ✅ Sí | ❌ No |
| **Timestamps** | ✅ Sí | ❌ No |

### ¿Cuál es la fuente de verdad?

**Base de Datos** es la fuente de verdad:
- Contiene TODOS los datos (token + cookies + metadata)
- Es usada por backend (cron, prebookings)
- Persiste incluso si usuario borra localStorage
- Soporta múltiples sesiones por usuario

**localStorage** es solo un cache:
- Contiene solo el token (para acceso rápido)
- Puede estar desincronizado temporalmente
- Se limpia en logout o al limpiar datos del navegador
- Único por navegador/dispositivo

### ¿Por qué guardamos en ambos?

1. **Rendimiento**: localStorage es más rápido que llamar a Supabase
2. **Offline support**: Frontend puede leer token sin hacer request a DB
3. **Backend needs DB**: Cron jobs y prebookings no tienen acceso a localStorage
4. **Multi-device**: Cada dispositivo tiene su propio localStorage pero comparten DB

### Flujo Ideal

```
Login → Guarda en DB + localStorage
  ↓
Timer (10 min) → Lee de localStorage → Refresh → Guarda en DB + localStorage
  ↓
Cron (10 min) → Lee de DB → Refresh → Guarda en DB (localStorage NO actualizado)
  ↓
Next Timer → Lee de localStorage (viejo) → Refresh → Obtiene token nuevo → Guarda en DB + localStorage
  ↓
Todo sincronizado de nuevo ✅
```

---

**Última Actualización**: 2025-10-20
**Estado**: ✅ Sistema funcionando correctamente con almacenamiento dual (DB + localStorage)
