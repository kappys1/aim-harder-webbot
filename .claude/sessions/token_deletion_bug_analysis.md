# Análisis del Bug: Borrado de Tokens Durante Prebooking

**Fecha**: 2025-10-18
**Problema**: Los tokens de sesión de dispositivos se borran inesperadamente durante el proceso de prebooking

---

## 🚨 Problema Identificado

### Síntomas
- Cuando un usuario registra una clase con prebooking, su token de sesión (device) se borra
- El usuario pierde su sesión activa aunque esté usando la aplicación
- El problema ocurre de forma intermitente, especialmente cuando hay prebookings activos

### Causa Raíz

El bug se encuentra en el endpoint `/api/auth/token-update` que es llamado por el frontend cada 10 minutos para refrescar el token.

**Archivo**: `app/api/auth/token-update/route.ts`

#### Problema 1: Obtención de Sesión Incorrecta
```typescript
// ❌ ANTES (INCORRECTO)
const session = await SupabaseSessionService.getSession(email);
```

**Por qué es un problema:**
- `getSession(email)` sin parámetros devuelve la sesión de **background** por defecto
- Esto significa que el endpoint está trabajando con la sesión equivocada
- Debería obtener la sesión específica del dispositivo usando el fingerprint

#### Problema 2: Borrado Indiscriminado de Sesiones
```typescript
// ❌ ANTES (INCORRECTO)
if (updateResult.logout) {
  await SupabaseSessionService.deleteSession(email);
  // ...
}
```

**Por qué es un problema:**
- `deleteSession(email)` sin parámetros ejecuta el "default behavior"
- El default behavior borra **TODAS las sesiones de tipo device**
- Esto significa que si una sesión expira, se borran TODAS las sesiones del usuario
- Incluso la sesión activa del dispositivo que está usando la app se elimina

### Escenario del Bug

1. **Usuario activo**: Tiene la app abierta con sesión activa (device + background)
2. **Prebooking programado**: El sistema usa la sesión de background (correcto)
3. **Frontend ejecuta refresh**: Cada 10 minutos llama a `/api/auth/token-update`
4. **Endpoint obtiene sesión background**: Por defecto, sin fingerprint
5. **Si la sesión background expira**: AimHarder responde con `{logout: 1}`
6. **Endpoint borra sesiones**: `deleteSession(email)` borra TODAS las sesiones device
7. **Usuario pierde sesión**: Aunque esté activamente usando la app

---

## ✅ Solución Implementada

### Cambio 1: Obtención de Sesión Específica

**Archivo**: `app/api/auth/token-update/route.ts:23-25`

```typescript
// ✅ DESPUÉS (CORRECTO)
const session = await SupabaseSessionService.getSession(email, {
  fingerprint
});
```

**Beneficio:**
- Ahora obtiene la sesión específica del dispositivo que está haciendo el request
- No interfiere con otras sesiones del usuario
- Cada dispositivo maneja su propia sesión independientemente

### Cambio 2: Borrado Específico de Sesión

**Archivo**: `app/api/auth/token-update/route.ts:46-49`

```typescript
// ✅ DESPUÉS (CORRECTO)
if (updateResult.logout) {
  await SupabaseSessionService.deleteSession(email, {
    fingerprint,
    sessionType: "device",
  });

  console.log(
    `[TOKEN UPDATE] Device session expired and deleted for ${email} (fingerprint: ${fingerprint.substring(0, 10)}...)`
  );
  // ...
}
```

**Beneficio:**
- Borra SOLO la sesión específica que expiró (usando fingerprint)
- No afecta a otras sesiones del usuario
- Logging mejorado para debugging

### Cambio 3: Actualización Específica de Token

**Archivo**: `app/api/auth/token-update/route.ts:81-92`

```typescript
// ✅ DESPUÉS (CORRECTO)
await SupabaseSessionService.updateRefreshToken(
  email,
  updateResult.newToken,
  fingerprint // Target specific device session
);

if (updateResult.cookies && updateResult.cookies.length > 0) {
  await SupabaseSessionService.updateCookies(
    email,
    updateResult.cookies,
    fingerprint // Target specific device session
  );
}
```

**Beneficio:**
- Actualiza SOLO la sesión específica del dispositivo
- Mantiene la integridad de cada sesión independiente

---

## ⚡ Mejora de Frecuencia de Refresh

### Problema Anterior
- **Cron job**: Cada 15 minutos
- **Frontend**: Cada 10 minutos
- **Inconsistencia**: El frontend refrescaba más frecuentemente que el cron

### Solución Implementada

#### 1. GitHub Actions Workflow
**Archivo**: `.github/workflows/refresh-tokens.yml:5-6`

```yaml
on:
  schedule:
    # Run every 10 minutes for more frequent token updates
    - cron: "*/10 * * * *"
```

**Cambio**: De 15 minutos → 10 minutos

#### 2. Frontend Hook
**Archivo**: `modules/auth/hooks/useTokenRefresh.hook.tsx:3`

```typescript
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds
```

**Consistencia**: Ahora ambos (cron + frontend) se ejecutan cada 10 minutos

### Beneficios
- ✅ Tokens se mantienen más frescos
- ✅ Menor probabilidad de expiración durante prebookings
- ✅ Consistencia entre backend y frontend
- ✅ Mejor experiencia de usuario

---

## 🔍 Análisis de Código Relacionado

### Arquitectura Multi-Sesión

El sistema implementa una arquitectura multi-sesión con dos tipos:

1. **Background Session** (`session_type: 'background'`)
   - Usado para cron jobs y prebookings
   - Nunca expira
   - Protegido contra borrado accidental
   - Un usuario tiene UNA sesión background

2. **Device Session** (`session_type: 'device'`)
   - Usado para dispositivos del usuario
   - Expira después de 7 días
   - Múltiples sesiones posibles (un usuario puede tener múltiples dispositivos)
   - Identificado por fingerprint único

### Método `deleteSession` - Behavior

**Archivo**: `modules/auth/api/services/supabase-session.service.ts:270-316`

```typescript
static async deleteSession(
  email: string,
  options: SessionDeleteOptions = {}
): Promise<void> {
  // CRITICAL: Protect background sessions from accidental deletion
  if (options.sessionType === 'background' && !options.confirmProtectedDeletion) {
    throw new Error(
      'Background session deletion requires explicit confirmation. ' +
      'Set confirmProtectedDeletion: true to proceed.'
    );
  }

  let query = supabaseAdmin
    .from("auth_sessions")
    .delete()
    .eq("user_email", email);

  // Priority 1: Delete specific session by fingerprint (ignores sessionType)
  if (options.fingerprint) {
    query = query.eq("fingerprint", options.fingerprint);
  }
  // Priority 2: Delete by session type
  else if (options.sessionType) {
    query = query.eq("session_type", options.sessionType);
  }
  // Priority 3: Default behavior - only delete device sessions
  else {
    query = query.eq("session_type", "device");
  }

  // ...
}
```

**Comportamiento:**
- Sin opciones → Borra TODAS las sesiones device
- Con `fingerprint` → Borra SOLO esa sesión específica (prioridad 1)
- Con `sessionType` → Borra todas las sesiones de ese tipo (prioridad 2)
- Background sessions → Requieren confirmación explícita

---

## 📊 Impacto y Testing

### Casos de Prueba Recomendados

1. **Test 1: Prebooking durante sesión activa**
   - Crear prebooking
   - Mantener app abierta
   - Verificar que la sesión device NO se borra

2. **Test 2: Expiración de sesión específica**
   - Usuario con múltiples dispositivos
   - Hacer que expire la sesión de un dispositivo
   - Verificar que solo se borra esa sesión específica

3. **Test 3: Refresh de tokens**
   - Verificar que el cron ejecuta cada 10 minutos
   - Verificar que el frontend ejecuta cada 10 minutos
   - Verificar que cada sesión se actualiza correctamente

4. **Test 4: Isolación de sesiones**
   - Usuario con device session + background session
   - Hacer expirar una sesión
   - Verificar que la otra sesión NO se ve afectada

---

## 🎯 Recomendaciones Adicionales

### 1. Monitoreo y Alertas
- Agregar métricas para tracking de sesiones borradas
- Alertar si se borran múltiples sesiones simultáneamente
- Dashboard para visualizar salud de sesiones

### 2. Logging Mejorado
- Log cada vez que se borra una sesión con contexto completo
- Incluir stack trace para debugging
- Agregar correlación ID para tracking end-to-end

### 3. Testing Automatizado
- Tests de integración para multi-sesión
- Tests de stress para prebookings concurrentes
- Tests de regresión para este bug específico

### 4. Documentación
- Actualizar CLAUDE.md con lessons learned
- Documentar el flujo de multi-sesión
- Crear diagrama de arquitectura de sesiones

---

## 📝 Resumen Ejecutivo

### ¿Qué se arregló?
1. ✅ El endpoint `/api/auth/token-update` ahora usa fingerprint correcto
2. ✅ Las sesiones se borran individualmente (no todas a la vez)
3. ✅ Las actualizaciones de token son específicas por sesión
4. ✅ Frecuencia de refresh aumentada de 15 min → 10 min
5. ✅ Consistencia entre cron y frontend

### ¿Por qué pasaba?
- El endpoint usaba la sesión equivocada (background en lugar de device)
- Cuando borraba sesiones, borraba TODAS las sesiones device
- Esto afectaba a usuarios activos durante prebookings

### ¿Qué hacer ahora?
1. Deploy los cambios
2. Monitorear logs para confirmación
3. Ejecutar tests manuales
4. Verificar que los prebookings no causan logout

---

## 📂 Archivos Modificados

1. `app/api/auth/token-update/route.ts`
   - Línea 23-25: Obtención de sesión con fingerprint
   - Línea 44-49: Borrado específico de sesión
   - Línea 81-92: Actualización específica de token y cookies

2. `.github/workflows/refresh-tokens.yml`
   - Línea 5-6: Cron de 15 min → 10 min

3. `modules/auth/hooks/useTokenRefresh.hook.tsx`
   - Línea 3: Interval de 10 minutos (consistente con cron)

---

## 🔗 Referencias

- Multi-Session Architecture: `.claude/sessions/context_session_multi_session_architecture.md`
- Session Service: `modules/auth/api/services/supabase-session.service.ts`
- Prebooking Scheduler: `modules/prebooking/business/prebooking-scheduler.business.ts`
- Cron Refresh: `app/api/cron/refresh-tokens/route.ts`
