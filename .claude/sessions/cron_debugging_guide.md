# Guía de Debugging: Cron Token Refresh

**Problema**: El cron job responde con éxito pero no actualiza `token_update_count` ni `last_token_update_date`

**Fecha**: 2025-10-20

---

## 🚨 Problema Identificado

### Síntoma
```bash
POST https://aim-harder-webbot.vercel.app/api/cron/refresh-tokens

Response:
{
  "success": true,
  "message": "Token refresh job started in background",
  "timestamp": "2025-10-20T07:04:47.275Z"
}
```

**Pero** en la base de datos:
- `token_update_count` NO se incrementa
- `last_token_update_date` sigue siendo `null`

### Causa Raíz

El endpoint `/api/cron/refresh-tokens` ejecuta el proceso en **background** (asíncrono):

```typescript
// app/api/cron/refresh-tokens/route.ts:19-32
processTokenRefreshInBackground().catch((error) => {
  console.error("Background token refresh error:", error);
});

// Respond immediately (BEFORE processing completes)
return NextResponse.json({
  success: true,
  message: "Token refresh job started in background",
  timestamp: new Date().toISOString(),
}, { status: 202 }); // 202 Accepted
```

**Esto significa**:
- El endpoint responde inmediatamente con 202 Accepted
- El proceso real se ejecuta en background
- **Los logs del proceso real NO son visibles en la respuesta HTTP**
- Necesitamos ver los logs de Vercel para saber qué pasó

---

## 🛠️ Endpoints de Debugging Creados

### 1. GET `/api/debug/cron-logs`

**Propósito**: Ver el estado actual de todas las sesiones

**Uso**:
```bash
GET https://aim-harder-webbot.vercel.app/api/debug/cron-logs
```

**Response**:
```json
{
  "success": true,
  "timestamp": "2025-10-20T10:30:00Z",
  "totalSessions": 3,
  "sessions": [
    {
      "email": "user@example.com",
      "fingerprint": "dev-abc123...",
      "sessionType": "device",
      "hasToken": true,
      "tokenLength": 156,
      "cookieCount": 8,
      "createdAt": "2025-10-20T08:00:00Z",
      "updatedAt": "2025-10-20T10:00:00Z",
      "lastTokenUpdateDate": "2025-10-20T10:00:00Z",  // ← Verificar esto
      "tokenUpdateCount": 5,  // ← Verificar esto
      "lastTokenUpdateError": null,
      "minutesSinceUpdate": 30
    },
    // ... más sesiones
  ],
  "stats": {
    "totalSessions": 3,
    "deviceSessions": 2,
    "backgroundSessions": 1,
    "sessionsWithTokenUpdates": 2,  // ← ¿Cuántas tienen updates?
    "sessionsWithErrors": 0
  }
}
```

**Qué verificar**:
1. ¿Cuántas sesiones existen?
2. ¿Tienen `tokenUpdateCount > 0`?
3. ¿`lastTokenUpdateDate` es `null` o tiene fecha?
4. ¿`minutesSinceUpdate` es > 20? (necesita refresh)

---

### 2. POST `/api/debug/test-token-refresh`

**Propósito**: Ejecutar token refresh **SÍNCRONO** para un usuario específico y ver TODOS los logs

**Uso**:
```bash
POST https://aim-harder-webbot.vercel.app/api/debug/test-token-refresh
Content-Type: application/json

{
  "email": "tu-email@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "email": "user@example.com",
  "timestamp": "2025-10-20T10:30:00Z",
  "totalSessions": 2,
  "results": [
    {
      "sessionId": "user@example.com_device_abc123",
      "sessionType": "device",
      "fingerprint": "dev-abc123...",
      "status": "success",  // ← "success", "failed", "expired", "skipped"
      "newTokenLength": 156,
      "aimharderResponse": {
        "success": true,
        "logout": false,
        "hasNewToken": true,
        "newTokenLength": 156,
        "cookieCount": 8,
        "error": null
      }
    },
    // ... más sesiones
  ],
  "verification": [
    {
      "sessionType": "device",
      "fingerprint": "dev-abc123...",
      "tokenUpdateCount": 6,  // ← ¿Se incrementó?
      "lastTokenUpdateDate": "2025-10-20T10:30:00Z",  // ← ¿Se actualizó?
      "lastTokenUpdateError": null
    }
  ],
  "logs": [
    "2025-10-20T10:30:00.000Z - [TEST] Starting token refresh test for user@example.com",
    "2025-10-20T10:30:00.100Z - [TEST] Step 1: Fetching sessions for user@example.com",
    "2025-10-20T10:30:00.200Z - [TEST] Found 2 sessions for user@example.com",
    // ... TODOS los logs paso a paso
  ]
}
```

**Ventajas**:
- ✅ Ejecución **SÍNCRONA** (espera a que termine)
- ✅ TODOS los logs incluidos en la respuesta
- ✅ Verificación automática después del update
- ✅ Paso a paso con timestamps

---

## 📋 Plan de Debugging

### Paso 1: Ver Estado Actual

```bash
GET https://aim-harder-webbot.vercel.app/api/debug/cron-logs
```

**Qué buscar**:
- ¿Existen sesiones?
- ¿Qué valores tienen `tokenUpdateCount` y `lastTokenUpdateDate`?
- ¿Hay errores en `lastTokenUpdateError`?

---

### Paso 2: Ejecutar Test Síncrono

```bash
POST https://aim-harder-webbot.vercel.app/api/debug/test-token-refresh
Content-Type: application/json

{
  "email": "TU_EMAIL_AQUI"
}
```

**Qué buscar en la respuesta**:

1. **results[]** - ¿Qué pasó con cada sesión?
   - `status: "success"` → OK
   - `status: "failed"` → Ver `error` field
   - `status: "expired"` → Session expirada
   - `status: "skipped"` → Token muy reciente

2. **aimharderResponse** - ¿Qué respondió AimHarder?
   - `success: true` → AimHarder respondió OK
   - `logout: true` → Token expirado
   - `hasNewToken: true` → Recibió nuevo token
   - `error` → Mensaje de error

3. **verification[]** - ¿Se actualizó la DB?
   - `tokenUpdateCount` → ¿Se incrementó?
   - `lastTokenUpdateDate` → ¿Tiene fecha nueva?

4. **logs[]** - Logs paso a paso
   - Lee los logs cronológicamente
   - Identifica dónde falla

---

### Paso 3: Analizar Logs

**Buscar en los logs**:

```
"[TEST] ✅ Token refresh successful, updating database..."
"[TEST] Updating token in database..."
"[TEST] ✅ Token updated"
"[TEST] Updating token update metadata..."
"[TEST] ✅ Metadata updated"
```

**Si ves estos logs → La actualización se ejecutó correctamente**

**Si NO ves estos logs → Hay un error antes**

Buscar mensajes de error:
```
"[TEST] ❌ Token refresh failed: ..."
"[TEST] ❌ Session expired (logout: 1)"
"[TEST] ❌ Error processing session ..."
```

---

## 🔍 Posibles Problemas y Soluciones

### Problema 1: AimHarder responde con `logout: true`

**Síntoma**:
```json
{
  "aimharderResponse": {
    "logout": true
  }
}
```

**Causa**: El token ya expiró (> 30 min sin refresh)

**Solución**:
- Usuario debe hacer re-login
- Se crearán nuevas sesiones

---

### Problema 2: AimHarder responde con error

**Síntoma**:
```json
{
  "aimharderResponse": {
    "success": false,
    "error": "Invalid token format"
  }
}
```

**Causa**: Token corrupto o cookies inválidas

**Solución**:
- Revisar formato del token en DB
- Verificar cookies en DB
- Usuario debe hacer re-login

---

### Problema 3: DB update falla

**Síntoma en logs**:
```
"[TEST] Updating token update metadata..."
(no hay "[TEST] ✅ Metadata updated")
```

**Posible causa**: Error en Supabase query

**Debugging adicional**:
1. Revisar logs de Vercel (pueden tener stack trace)
2. Verificar permisos de Supabase
3. Verificar que `fingerprint` exista en DB

---

### Problema 4: Session not found

**Síntoma**:
```json
{
  "success": false,
  "error": "No sessions found for user@example.com"
}
```

**Causa**: No hay sesiones en DB para ese email

**Solución**:
- Usuario debe hacer login primero
- Verificar que dual login creó ambas sesiones (device + background)

---

## 📊 Análisis del Código Actual

### ¿Por qué el cron NO muestra logs?

**Problema**: El cron ejecuta en background y retorna inmediatamente

```typescript
// app/api/cron/refresh-tokens/route.ts

// Ejecuta en background (no espera)
processTokenRefreshInBackground().catch(...);

// Retorna INMEDIATAMENTE (antes de que termine el proceso)
return NextResponse.json({ success: true, ... });
```

**Consecuencia**:
- Los logs de `processTokenRefreshInBackground()` van a **Vercel logs** (no HTTP response)
- Solo podemos ver los logs en Vercel Dashboard → Functions → Logs
- La respuesta HTTP solo dice "started in background"

**Alternativa para debugging**:
- Usar `/api/debug/test-token-refresh` (síncrono, logs en response)

---

### ¿Dónde se actualizan los campos?

**`token_update_count` y `last_token_update_date`**:

```typescript
// modules/auth/api/services/supabase-session.service.ts:626-679

static async updateTokenUpdateData(
  email: string,
  success: boolean,
  error?: string,
  fingerprint?: string
): Promise<void> {
  if (success) {
    // Incrementa el contador
    const updateData = {
      token_update_count: currentCount + 1,  // ← Aquí
      last_token_update_date: now,           // ← Aquí
      last_token_update_error: null,
      updated_at: now,
    };

    // Update query con fingerprint
    await supabaseAdmin
      .from("auth_sessions")
      .update(updateData)
      .eq("user_email", email)
      .eq("fingerprint", fingerprint);  // ← Debe coincidir
  }
}
```

**Llamado desde cron**:

```typescript
// app/api/cron/refresh-tokens/route.ts:199-204

await SupabaseSessionService.updateTokenUpdateData(
  session.email,
  true,  // success
  undefined,
  session.fingerprint  // ← CRÍTICO: debe ser el correcto
);
```

**Posible fallo**:
- Si `session.fingerprint` es `null` o vacío → Query no encuentra la sesión
- Si `session.email` no coincide → Query no encuentra la sesión

---

## 🎯 Siguientes Pasos

### 1. Ejecutar Debug Endpoints

```bash
# Ver estado actual
curl https://aim-harder-webbot.vercel.app/api/debug/cron-logs

# Test síncrono para tu usuario
curl -X POST https://aim-harder-webbot.vercel.app/api/debug/test-token-refresh \
  -H "Content-Type: application/json" \
  -d '{"email":"TU_EMAIL"}'
```

### 2. Analizar Respuestas

- Revisar `verification[]` para ver si `tokenUpdateCount` se incrementó
- Revisar `logs[]` para ver paso a paso qué pasó
- Buscar mensajes de error

### 3. Revisar Vercel Logs

Si el test síncrono funciona pero el cron no:

1. Ir a Vercel Dashboard
2. Tu proyecto → Functions → Logs
3. Filtrar por `/api/cron/refresh-tokens`
4. Buscar logs con `[CRON_REFRESH xxx]`
5. Identificar errores

### 4. Reportar Hallazgos

Una vez ejecutes los endpoints, comparte:
- Response de `/api/debug/cron-logs`
- Response de `/api/debug/test-token-refresh`
- Logs de Vercel (si es posible)

---

## 📝 Checklist de Verificación

Antes de ejecutar:
- [ ] Deploy los nuevos endpoints de debug
- [ ] Tienes acceso a Vercel Dashboard
- [ ] Sabes tu email de usuario
- [ ] Tienes sesiones activas en DB (hiciste login)

Después de ejecutar `/api/debug/cron-logs`:
- [ ] ¿Cuántas sesiones existen?
- [ ] ¿`tokenUpdateCount` es > 0?
- [ ] ¿`lastTokenUpdateDate` tiene valor?
- [ ] ¿`minutesSinceUpdate` es > 20?

Después de ejecutar `/api/debug/test-token-refresh`:
- [ ] ¿Todas las sesiones tienen `status: "success"`?
- [ ] ¿`aimharderResponse.success` es `true`?
- [ ] ¿`verification[].tokenUpdateCount` se incrementó?
- [ ] ¿`verification[].lastTokenUpdateDate` se actualizó?
- [ ] ¿Los logs muestran "✅ Metadata updated"?

---

**Última Actualización**: 2025-10-20
**Estado**: Endpoints de debugging creados, esperando ejecución de tests
