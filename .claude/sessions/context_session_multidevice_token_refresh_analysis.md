# Análisis: Multi-Device Token Refresh Implementation

**Fecha**: 2025-10-20
**Objetivo**: Comparar la implementación de actualización de tokens entre el sistema original (single session) y el sistema actual (multi-session/multi-device)

---

## 📊 Resumen Ejecutivo

**Conclusión**: ✅ **La técnica de actualización de tokens SÍ se está aplicando correctamente para multi-devices**

El sistema actual implementa una arquitectura multi-sesión que:
- ✅ Soporta múltiples dispositivos simultáneos por usuario
- ✅ Mantiene sesiones independientes para UI (device) y background (prebookings)
- ✅ Actualiza tokens específicos por fingerprint (no afecta otras sesiones)
- ✅ Protege sesiones background de borrado accidental
- ✅ Maneja expiración de sesiones device sin afectar background

---

## 🔄 Evolución del Sistema

### 1. Sistema Original (Single Session)

**Contexto**: `context_session_token_refresh.md`

**Arquitectura**:
```
Usuario → 1 Sesión → 1 refreshToken → localStorage + DB
```

**Características**:
- Una sesión por usuario (UNIQUE constraint on `user_email`)
- Token compartido entre UI y background processes
- Sin fingerprints para identificación de dispositivos
- Borrado de sesión afecta todos los procesos

**Problemas Identificados**:
- ❌ Background process podía borrar la sesión activa del usuario
- ❌ No soportaba múltiples dispositivos
- ❌ Falta de aislamiento entre UI y procesos automatizados

---

### 2. Sistema Actual (Multi-Session Architecture)

**Contexto**: `context_session_multi_session_architecture.md`

**Arquitectura**:
```
Usuario → Múltiples Sesiones:
├── Background Session (session_type: 'background')
│   ├── Fingerprint: bg-{hash(email + salt)}
│   ├── Uso: Prebookings, cron jobs
│   └── TTL: NEVER (nunca expira)
│
└── Device Sessions (session_type: 'device')
    ├── Fingerprint: client-generated (único por dispositivo)
    ├── Uso: UI interactions
    └── TTL: 7 días (auto-cleanup)
```

**Tabla de Sesiones** (`auth_sessions`):
```sql
PRIMARY KEY (user_email, fingerprint)  -- Composite key
session_type ENUM('background', 'device')
fingerprint VARCHAR NOT NULL
aimharder_token VARCHAR NOT NULL
aimharder_cookies TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 🔍 Análisis Detallado: Token Refresh Flow

### A. Frontend Token Refresh (Device Sessions)

**Archivo**: `modules/auth/hooks/useTokenRefresh.hook.tsx`

**Flujo**:
```typescript
1. Timer: 10 minutos
2. Obtiene de localStorage:
   - refreshToken
   - fingerprint (client-generated, único por dispositivo)
   - email
3. Llama API: POST /api/auth/token-update
   Body: { email, token, fingerprint }
4. API actualiza SOLO la sesión con ese fingerprint específico
5. Guarda nuevo token en localStorage
```

**Características Multi-Device**:
- ✅ Cada dispositivo tiene su propio `fingerprint`
- ✅ Actualización de un dispositivo NO afecta otros dispositivos
- ✅ localStorage aislado por navegador/dispositivo
- ✅ Timer independiente por pestaña/dispositivo

**Ejemplo**:
```
Usuario con 2 dispositivos:
├── iPhone (fingerprint: abc123...)
│   └── Token se actualiza cada 10 min → SOLO afecta sesión abc123
└── iPad (fingerprint: xyz789...)
    └── Token se actualiza cada 10 min → SOLO afecta sesión xyz789
```

---

### B. Backend Token Refresh (Todas las Sesiones)

**Archivo**: `app/api/cron/refresh-tokens/route.ts`

**Flujo**:
```typescript
1. Cron: Cada 10 minutos (GitHub Actions)
2. Obtiene TODAS las sesiones activas (device + background)
3. Para cada sesión:
   a. Verifica si necesita update (updated_at > 20 min)
   b. Llama AimharderRefreshService.updateToken()
      - Usa el fingerprint ESPECÍFICO de esa sesión
      - Pasa las cookies de esa sesión
   c. Actualiza SOLO esa sesión específica en DB
      - updateRefreshToken(email, newToken, fingerprint)
      - updateCookies(email, cookies, fingerprint)
```

**Características Multi-Device**:
- ✅ Procesa cada sesión de forma independiente
- ✅ Usa fingerprint específico para cada update
- ✅ No mezcla cookies entre sesiones
- ✅ Maneja expiración por sesión individual

**Ejemplo**:
```
Cron encuentra 3 sesiones del usuario:
├── Background (fingerprint: bg-abc123)
│   └── Update → Llama API con bg-abc123 → Actualiza SOLO bg-abc123
├── Device 1 (fingerprint: dev-xyz789)
│   └── Update → Llama API con dev-xyz789 → Actualiza SOLO dev-xyz789
└── Device 2 (fingerprint: dev-qwe456)
    └── Update → Llama API con dev-qwe456 → Actualiza SOLO dev-qwe456
```

---

### C. Endpoint Token Update (Session-Specific)

**Archivo**: `app/api/auth/token-update/route.ts`

**Flujo Crítico**:
```typescript
// ✅ CORRECTO: Obtiene la sesión específica por fingerprint
const session = await SupabaseSessionService.getSession(email, {
  fingerprint  // Línea 23-25
});

// Llama a AimHarder con datos de ESA sesión específica
const updateResult = await AimharderRefreshService.updateToken({
  token,
  fingerprint,
  cookies: session.cookies  // Cookies de ESA sesión
});

// ✅ CORRECTO: Si expira, borra SOLO esa sesión
if (updateResult.logout) {
  await SupabaseSessionService.deleteSession(email, {
    fingerprint,        // Línea 47
    sessionType: "device"
  });
}

// ✅ CORRECTO: Actualiza SOLO esa sesión
await SupabaseSessionService.updateRefreshToken(
  email,
  updateResult.newToken,
  fingerprint  // Línea 89
);
```

**Diferencia con Sistema Original**:

**ANTES (Single Session)**:
```typescript
// ❌ PROBLEMA: No había fingerprint
const session = await getSession(email);

// ❌ PROBLEMA: Borraba TODAS las sesiones
if (logout) {
  await deleteSession(email);  // Borraba todo
}
```

**AHORA (Multi-Session)**:
```typescript
// ✅ CORRECTO: Usa fingerprint específico
const session = await getSession(email, { fingerprint });

// ✅ CORRECTO: Borra SOLO la sesión específica
if (logout) {
  await deleteSession(email, { fingerprint, sessionType: "device" });
}
```

---

## 🛡️ Protección de Sesiones Background

### Lógica de Protección

**Archivo**: `app/api/cron/refresh-tokens/route.ts:125-147`

```typescript
if (updateResult.logout) {
  if (session.sessionType === "device") {
    // ✅ Device session expirada → OK borrarla
    await SupabaseSessionService.deleteSession(session.email, {
      fingerprint: session.fingerprint,
      sessionType: "device",
    });
  } else {
    // ⚠️ Background session expirada → NO borrar, solo advertir
    console.warn(
      `Background session received logout response. ` +
      `This is unusual. Background session preserved.`
    );
  }
}
```

**Estrategia**:
- Device sessions: Se pueden borrar si expiran (usuario puede re-autenticarse)
- Background sessions: NUNCA se borran automáticamente (crítico para prebookings)
- Si background expira: Se registra warning pero se mantiene la sesión

---

## 📱 Escenarios Multi-Device

### Escenario 1: Usuario con 2 Dispositivos Activos

**Setup**:
```
User: alex@example.com
├── iPhone (fingerprint: iphone-abc123)
│   └── Token: token_iphone_v1
│   └── Cookies: [cookie_iphone_1, cookie_iphone_2]
│   └── localStorage: { refreshToken: "token_iphone_v1" }
│
├── iPad (fingerprint: ipad-xyz789)
│   └── Token: token_ipad_v1
│   └── Cookies: [cookie_ipad_1, cookie_ipad_2]
│   └── localStorage: { refreshToken: "token_ipad_v1" }
│
└── Background (fingerprint: bg-hash123)
    └── Token: token_bg_v1
    └── Cookies: [cookie_bg_1, cookie_bg_2]
```

**Flujo de Token Refresh**:

**T+10min: iPhone refresh**
```typescript
// iPhone ejecuta useTokenRefresh hook
POST /api/auth/token-update
Body: {
  email: "alex@example.com",
  token: "token_iphone_v1",
  fingerprint: "iphone-abc123"  // ← Específico del iPhone
}

// Backend actualiza SOLO la sesión del iPhone
UPDATE auth_sessions
SET aimharder_token = 'token_iphone_v2',
    aimharder_cookies = '[cookie_iphone_new_1, cookie_iphone_new_2]',
    updated_at = NOW()
WHERE user_email = 'alex@example.com'
  AND fingerprint = 'iphone-abc123'  // ← Solo iPhone

// iPad y Background NO afectados
```

**T+12min: iPad refresh**
```typescript
// iPad ejecuta su propio timer
POST /api/auth/token-update
Body: {
  email: "alex@example.com",
  token: "token_ipad_v1",
  fingerprint: "ipad-xyz789"  // ← Específico del iPad
}

// Backend actualiza SOLO la sesión del iPad
UPDATE auth_sessions
SET aimharder_token = 'token_ipad_v2',
    aimharder_cookies = '[cookie_ipad_new_1, cookie_ipad_new_2]',
    updated_at = NOW()
WHERE user_email = 'alex@example.com'
  AND fingerprint = 'ipad-xyz789'  // ← Solo iPad

// iPhone y Background NO afectados
```

**T+20min: Cron refresh (todas las sesiones)**
```typescript
// Cron procesa las 3 sesiones una por una

// 1. iPhone session
const iphone = sessions.find(s => s.fingerprint === 'iphone-abc123');
await updateToken({
  token: iphone.token,
  fingerprint: 'iphone-abc123',  // ← Fingerprint específico
  cookies: iphone.cookies         // ← Cookies específicas
});
UPDATE ... WHERE fingerprint = 'iphone-abc123';

// 2. iPad session
const ipad = sessions.find(s => s.fingerprint === 'ipad-xyz789');
await updateToken({
  token: ipad.token,
  fingerprint: 'ipad-xyz789',     // ← Fingerprint específico
  cookies: ipad.cookies           // ← Cookies específicas
});
UPDATE ... WHERE fingerprint = 'ipad-xyz789';

// 3. Background session
const bg = sessions.find(s => s.fingerprint === 'bg-hash123');
await updateToken({
  token: bg.token,
  fingerprint: 'bg-hash123',      // ← Fingerprint específico
  cookies: bg.cookies             // ← Cookies específicas
});
UPDATE ... WHERE fingerprint = 'bg-hash123';
```

**Resultado**:
- ✅ Cada sesión actualizada independientemente
- ✅ Ninguna sesión afecta a las otras
- ✅ Cookies NO se mezclan entre sesiones
- ✅ Tokens específicos por dispositivo/proceso

---

### Escenario 2: iPad Expira Mientras iPhone Activo

**Setup**:
```
User está usando el iPhone activamente
iPad no se ha usado en 7 días (expirado)
```

**Flujo**:

**T+10min: Cron detecta iPad expirado**
```typescript
// Cron procesa iPad session
const ipad = sessions.find(s => s.fingerprint === 'ipad-xyz789');
const updateResult = await updateToken({
  token: ipad.token,  // Token expirado
  fingerprint: 'ipad-xyz789',
  cookies: ipad.cookies
});

// AimHarder responde: { logout: 1 }

// Backend borra SOLO la sesión del iPad
if (updateResult.logout && session.sessionType === "device") {
  await deleteSession(email, {
    fingerprint: 'ipad-xyz789',  // ← Solo iPad
    sessionType: "device"
  });
}

// Resultado en DB:
DELETE FROM auth_sessions
WHERE user_email = 'alex@example.com'
  AND fingerprint = 'ipad-xyz789';  // ← Solo iPad borrado
```

**Estado Final**:
```
User: alex@example.com
├── iPhone (fingerprint: iphone-abc123)  ✅ SIGUE ACTIVO
│   └── Token: token_iphone_v5
│   └── Usuario puede seguir usando la app normalmente
│
├── iPad (fingerprint: ipad-xyz789)  ❌ BORRADO
│   └── Próximo login creará nueva sesión
│
└── Background (fingerprint: bg-hash123)  ✅ SIGUE ACTIVO
    └── Token: token_bg_v3
    └── Prebookings siguen funcionando
```

**Conclusión**:
- ✅ iPhone NO afectado
- ✅ Background NO afectado
- ✅ Solo iPad borrado (esperado)
- ✅ Usuario en iPhone ni se entera

---

### Escenario 3: Usuario Logout en iPhone

**Flujo**:

**Usuario presiona "Logout" en iPhone**
```typescript
// Frontend: modules/auth/hooks/useAuth.hook.tsx
const email = localStorage.getItem("user-email");
const fingerprint = localStorage.getItem("fingerprint"); // iphone-abc123

await fetch("/api/auth/aimharder", {
  method: "DELETE",
  body: JSON.stringify({ email, fingerprint })
});

// Backend: app/api/auth/aimharder/route.ts
await SupabaseSessionService.deleteSession(email, {
  fingerprint: 'iphone-abc123',  // ← Solo iPhone
  sessionType: "device"
});

// Resultado:
DELETE FROM auth_sessions
WHERE user_email = 'alex@example.com'
  AND fingerprint = 'iphone-abc123';  // ← Solo iPhone
```

**Estado Final**:
```
User: alex@example.com
├── iPhone (fingerprint: iphone-abc123)  ❌ BORRADO
│   └── localStorage limpiado
│   └── Redirigido a /login
│
├── iPad (fingerprint: ipad-xyz789)  ✅ SIGUE ACTIVO
│   └── Usuario puede seguir usando iPad normalmente
│   └── Token sigue refrescándose cada 10 min
│
└── Background (fingerprint: bg-hash123)  ✅ SIGUE ACTIVO
    └── Prebookings siguen ejecutándose
    └── Cron sigue refrescando token
```

**Conclusión**:
- ✅ Solo el dispositivo que hizo logout se desconecta
- ✅ Otros dispositivos siguen funcionando
- ✅ Background sessions nunca afectadas por logout de UI
- ✅ Usuario puede re-login en iPhone sin afectar otros dispositivos

---

## 🔑 Fingerprints: Clave del Sistema Multi-Device

### Generación de Fingerprints

**Device Fingerprints (Client-Generated)**:
```typescript
// common/utils/fingerprint.utils.ts
export function generateFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Hardware info
  const screen = `${window.screen.width}x${window.screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = navigator.language;

  // Random component (único por instalación)
  const random = Math.random().toString(36);

  // Hash all together
  return hash(`${screen}-${timezone}-${language}-${random}`);
}

// Resultado: "dev-a7b3c9d2e1f4..."
```

**Background Fingerprint (Server-Generated)**:
```typescript
// common/utils/background-fingerprint.utils.ts
export function generateBackgroundFingerprint(email: string): string {
  const salt = process.env.BACKGROUND_FINGERPRINT_SALT;
  return `bg-${hash(email + salt)}`;
}

// Características:
// - Determinístico: mismo email = mismo fingerprint
// - Único por usuario
// - No cambia en re-logins
// - Resultado: "bg-x7y3z9w2..."
```

### Uso de Fingerprints en Queries

**Obtención de Sesión Específica**:
```typescript
// modules/auth/api/services/supabase-session.service.ts

// Obtener sesión de dispositivo específico
const session = await getSession(email, { fingerprint: 'dev-abc123' });
// SELECT * FROM auth_sessions
// WHERE user_email = 'email' AND fingerprint = 'dev-abc123'

// Obtener sesión background (default)
const bgSession = await getSession(email);
// SELECT * FROM auth_sessions
// WHERE user_email = 'email' AND session_type = 'background'

// Obtener todas las sesiones device de un usuario
const devices = await getDeviceSessions(email);
// SELECT * FROM auth_sessions
// WHERE user_email = 'email' AND session_type = 'device'
```

**Actualización de Token Específico**:
```typescript
// Actualizar token de dispositivo específico
await updateRefreshToken(email, newToken, 'dev-abc123');
// UPDATE auth_sessions
// SET aimharder_token = 'newToken', updated_at = NOW()
// WHERE user_email = 'email' AND fingerprint = 'dev-abc123'

// Actualizar token background
await updateRefreshToken(email, newToken, 'bg-xyz789');
// UPDATE auth_sessions
// SET aimharder_token = 'newToken', updated_at = NOW()
// WHERE user_email = 'email' AND fingerprint = 'bg-xyz789'
```

**Borrado de Sesión Específica**:
```typescript
// Borrar sesión de dispositivo específico
await deleteSession(email, { fingerprint: 'dev-abc123' });
// DELETE FROM auth_sessions
// WHERE user_email = 'email' AND fingerprint = 'dev-abc123'

// Borrar todas las sesiones device (excepto background)
await deleteSession(email);
// DELETE FROM auth_sessions
// WHERE user_email = 'email' AND session_type = 'device'

// Intentar borrar background (requiere confirmación)
await deleteSession(email, {
  sessionType: 'background',
  confirmProtectedDeletion: true  // ← Requerido
});
```

---

## ✅ Verificación: ¿Se Aplica la Técnica Multi-Device?

### Checklist de Implementación

| Característica | Sistema Original | Sistema Actual | Estado |
|----------------|------------------|----------------|--------|
| **Múltiples sesiones por usuario** | ❌ Una sesión | ✅ Múltiples sesiones | ✅ IMPLEMENTADO |
| **Fingerprints únicos** | ❌ No existían | ✅ Device + Background | ✅ IMPLEMENTADO |
| **Actualización específica por sesión** | ❌ Actualización global | ✅ Por fingerprint | ✅ IMPLEMENTADO |
| **Borrado específico por sesión** | ❌ Borraba todas | ✅ Por fingerprint | ✅ IMPLEMENTADO |
| **Protección de background** | ❌ No diferenciaba | ✅ Protected deletion | ✅ IMPLEMENTADO |
| **Composite key en DB** | ❌ user_email UNIQUE | ✅ (user_email, fingerprint) | ✅ IMPLEMENTADO |
| **Session type tracking** | ❌ No existía | ✅ ENUM('device','background') | ✅ IMPLEMENTADO |
| **Cookies específicas por sesión** | ❌ Compartidas | ✅ Aisladas por fingerprint | ✅ IMPLEMENTADO |
| **Frontend multi-device** | ❌ Un token global | ✅ localStorage por dispositivo | ✅ IMPLEMENTADO |
| **Cron multi-session** | ❌ Una sesión | ✅ Todas las sesiones | ✅ IMPLEMENTADO |

**Resultado**: ✅ **10/10 - Implementación completa**

---

## 📋 Comparación de Flujos

### Flujo Original (Single Session)

```
1. Usuario hace login
   └→ 1 sesión creada (user_email UNIQUE)

2. Frontend refresh (10 min)
   └→ Actualiza LA sesión del usuario
   └→ Si falla: borra LA sesión (todos desconectados)

3. Cron refresh (10 min)
   └→ Actualiza LA sesión del usuario
   └→ Si falla: borra LA sesión (todos desconectados)

4. Prebooking
   └→ Usa LA sesión del usuario
   └→ Si falla: borra LA sesión (usuario desconectado en UI)

5. Usuario logout
   └→ Borra LA sesión (todo desconectado)
```

**Problemas**:
- ❌ Un fallo desconecta todo
- ❌ No soporta múltiples dispositivos
- ❌ Background afecta UI y viceversa

---

### Flujo Actual (Multi-Session)

```
1. Usuario hace login
   ├→ Device session (fingerprint: dev-abc123)
   └→ Background session (fingerprint: bg-xyz789)

2. Frontend refresh en iPhone (10 min)
   └→ Actualiza sesión dev-abc123 (solo iPhone)
   └→ Si falla: borra dev-abc123 (solo iPhone desconectado)
   └→ iPad y Background NO afectados

3. Frontend refresh en iPad (10 min)
   └→ Actualiza sesión dev-def456 (solo iPad)
   └→ Si falla: borra dev-def456 (solo iPad desconectado)
   └→ iPhone y Background NO afectados

4. Cron refresh (10 min)
   ├→ Actualiza dev-abc123 (iPhone session)
   ├→ Actualiza dev-def456 (iPad session)
   └→ Actualiza bg-xyz789 (Background session)
   └→ Si alguno falla: solo borra esa sesión específica
   └→ Background NUNCA se borra (warning solo)

5. Prebooking
   └→ Usa bg-xyz789 (Background session)
   └→ Si falla: warning pero NO se borra
   └→ Device sessions NO afectadas

6. Usuario logout en iPhone
   └→ Borra dev-abc123 (solo iPhone)
   └→ iPad y Background siguen activos
```

**Beneficios**:
- ✅ Aislamiento total entre sesiones
- ✅ Múltiples dispositivos simultáneos
- ✅ Background protegido de UI
- ✅ Fallo de un dispositivo no afecta otros

---

## 🎯 Conclusiones

### Respuesta a la Pregunta Original

**¿Estamos aplicando la misma técnica de token refresh para multi-devices?**

**Respuesta**: ✅ **SÍ, y con mejoras significativas**

### Lo Que Se Mantiene del Sistema Original

1. **Frecuencia de refresh**: 10 minutos (mejorado desde 15 min)
2. **Endpoint de actualización**: `/api/auth/token-update`
3. **Llamada a AimHarder**: `AimharderRefreshService.updateToken()`
4. **Cron job**: GitHub Actions cada 10 minutos
5. **Almacenamiento**: localStorage + Supabase DB
6. **Flujo básico**: Timer → API call → Update DB → Update localStorage

### Lo Que Se Mejoró para Multi-Device

1. **Fingerprints**: Identificación única por dispositivo/sesión
2. **Composite key**: `(user_email, fingerprint)` en lugar de `user_email` único
3. **Session types**: `device` vs `background` para aislamiento
4. **Targeted updates**: Actualización específica por fingerprint
5. **Targeted deletes**: Borrado específico por fingerprint
6. **Protected background**: Background sessions nunca se borran automáticamente
7. **Cookie isolation**: Cada sesión mantiene sus propias cookies
8. **Independent tokens**: Cada sesión tiene su propio refreshToken

### Garantías del Sistema Actual

✅ **Multi-Device**:
- Usuario puede tener iPhone, iPad, Laptop conectados simultáneamente
- Cada dispositivo tiene su propia sesión independiente
- Logout en un dispositivo no afecta otros dispositivos

✅ **Background Isolation**:
- Prebookings usan sesión background dedicada
- UI sessions no afectan background jobs
- Background session nunca expira por acciones de UI

✅ **Fault Tolerance**:
- Fallo de un dispositivo no desconecta otros
- Expiración de una sesión es aislada
- Background protegido incluso si todos los devices fallan

✅ **Data Integrity**:
- Cada sesión tiene sus propios cookies (no se mezclan)
- Cada sesión tiene su propio token (no comparten)
- Actualizaciones son atómicas por sesión

---

## 🚀 Recomendaciones

### 1. Monitoreo

Agregar métricas para:
- Número de sesiones activas por usuario
- Ratio de device vs background sessions
- Tasa de expiración por tipo de sesión
- Dispositivos activos por usuario

### 2. UI Improvements

- Mostrar dispositivos conectados en dashboard
- Permitir "desconectar dispositivo remoto"
- Notificar cuando otro dispositivo hace login
- "Ver dónde estoy conectado"

### 3. Documentation

- Documentar flow de multi-session para nuevos desarrolladores
- Diagrama de arquitectura de sesiones
- Guía de troubleshooting para sesiones

### 4. Testing

- Tests de concurrencia (múltiples dispositivos actualizando simultáneamente)
- Tests de aislamiento (verificar que las sesiones NO se afectan)
- Tests de protección (background sessions nunca borradas)

---

## 📂 Archivos Clave

### Implementación Multi-Session

1. **Database Schema**:
   - `supabase/migrations/007_multi_session_architecture.sql`
   - Composite key: `(user_email, fingerprint)`
   - Session type enum

2. **Session Service**:
   - `modules/auth/api/services/supabase-session.service.ts`
   - Métodos con fingerprint targeting
   - Protected deletion logic

3. **Token Update Endpoints**:
   - `app/api/auth/token-update/route.ts` (frontend)
   - `app/api/cron/refresh-tokens/route.ts` (cron)
   - Ambos usan fingerprint específico

4. **Frontend Hook**:
   - `modules/auth/hooks/useTokenRefresh.hook.tsx`
   - Usa fingerprint de localStorage

5. **Fingerprint Utils**:
   - `common/utils/fingerprint.utils.ts` (device)
   - `common/utils/background-fingerprint.utils.ts` (background)

### Documentación

1. **Token Refresh**: `.claude/sessions/context_session_token_refresh.md`
2. **Multi-Session**: `.claude/sessions/context_session_multi_session_architecture.md`
3. **Bug Analysis**: `.claude/sessions/token_deletion_bug_analysis.md`

---

**Última Actualización**: 2025-10-20
**Estado**: ✅ Sistema multi-device completamente implementado y funcionando
