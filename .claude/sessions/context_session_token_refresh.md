# Context Session: Token Refresh System

## Feature Overview
Implementar el sistema de actualización automática de tokens (refresh token) tanto en frontend como en backend para mantener viva la sesión de Aimharder.

## Initial Analysis

### Current State
1. **Login Flow (✅ Implemented)**
   - Login → obtiene token inicial
   - Llama a `setrefresh` → obtiene `refreshToken` y `fingerprint`
   - Guarda en Supabase tabla `auth_sessions`

2. **Missing Implementation**
   - ❌ Frontend: No hay auto-refresh cada 25 minutos
   - ❌ Backend: No hay endpoint `/api/auth/token-update`
   - ❌ Backend: No hay GitHub Actions cron para mantener sesiones activas

### Aimharder's Token Mechanism
```javascript
// Original implementation from Aimharder
var milisegundos = 1740 * 1000; // 29 minutes

function cicloCookie() {
    if (localStorage.getItem("refreshToken") != null) {
        var tokenCheck = localStorage.getItem("refreshToken");
        var huella = generarHuella();
        $.ajax({
            type: "POST",
            data: {
                token: tokenCheck,
                ciclo: 1,
                fingerprint: huella
            },
            url: "/api/tokenUpdate",
            success: function (xhr) {
                var resp = $.parseJSON(xhr);
                if (resp.logout == null) {
                    localStorage.setItem("refreshToken", resp.newToken);
                    setTimeout(cicloCookie, milisegundos);
                } else {
                    localStorage.removeItem("refreshToken");
                    window.location = "https://aimharder.com/logout";
                }
            }
        });
    }
}
```

### API Calls Required

1. **POST https://aimharder.com/api/tokenUpdate**
   - Request: `{ token, ciclo: 1, fingerprint }`
   - Success Response: `{ newToken: "..." }`
   - Logout Response: `{ logout: true }`

2. **GET https://aimharder.com/setrefresh**
   - Query params: `?token={token}&fingerprint={fingerprint}`
   - Returns HTML with localStorage script

## Requirements

### Frontend Requirements

1. **Token Refresh Service**
   - Call `/api/auth/token-update` every **25 minutes** (1500s)
   - Use current `refreshToken` from localStorage or memory
   - Use `fingerprint` from localStorage
   - Update `refreshToken` in localStorage + sync with DB
   - Logout on failure or `logout` response
   - Stop timer on logout or tab close

2. **Page Reload Synchronization**
   - On page load/reload:
     1. Check if user has session (cookie/localStorage)
     2. Call `GET /api/auth/session` to get latest data from DB
     3. Update localStorage with: `refreshToken`, `cookies`, `fingerprint`
     4. Start 25-minute timer from 0

3. **Storage Strategy**
   - Store `refreshToken` in localStorage for persistence
   - Store `fingerprint` in localStorage
   - Always prioritize latest values from DB on reload
   - Frontend timer continues even if backend updated

4. **Integration Points**
   - Start timer after successful login
   - Stop timer on logout
   - Restart timer (from 0) on page reload with fresh DB data

### Backend Requirements

1. **API Endpoint: POST `/api/auth/token-update`**
   - Receive: `{ email, token, fingerprint }`
   - Call Aimharder's `/api/tokenUpdate` with cookies
   - Parse response (handle `newToken` or `logout`)
   - Extract new cookies from response
   - Update Supabase: new token + new cookies + timestamp
   - Return: `{ success, newToken }` or `{ logout: true }`

2. **API Endpoint: GET `/api/auth/session` (NEW)**
   - **Security**: HttpOnly Cookie authentication (Opción A)
   - Read session cookie to identify user
   - Fetch from Supabase: `refreshToken`, `cookies`, `fingerprint`, `updated_at`
   - Return: `{ refreshToken, cookies, fingerprint, lastUpdate }`
   - **NO exponer email en URL**
   - **NO permitir acceso sin cookie válida**

3. **GitHub Actions Cron Job**
   - Schedule: Every **29 minutes** (`*/29 * * * *`)
   - Workflow:
     1. Get all active sessions from Supabase
     2. For each session where `updated_at` > 30 minutes:
        - Call Aimharder `/api/tokenUpdate`
        - Update token + cookies in DB
        - Track refresh attempts and errors
     3. Mark failed sessions for review
   - **Only updates if > 30 min old** to avoid conflicts with frontend

4. **Database Updates**
   - Update `aimharder_token` with new refreshToken
   - Update `aimharder_cookies` with new cookies from response
   - Update `updated_at` timestamp
   - Track `last_refresh_date`, `refresh_count`, `last_refresh_error`

### Conflict Prevention Strategy

**Problem**: Frontend y Backend podrían actualizar el token simultáneamente.

**Solution**:
1. **Frontend**: Actualiza cada 25 minutos - **prioridad al usuario**
2. **Backend Cron**: Solo actualiza si `updated_at` > 30 minutos
3. **No cancela frontend update**: Usuario sigue navegando sin interrupciones
4. **Backend maneja pre-reservas**: Cuando usuario cierra ventana
5. **Sincronización en reload**: Siempre toma último token de DB

**Timing Strategy**:
- `T+0`: Usuario hace login
- `T+25min`: Frontend actualiza token
- `T+29min`: Backend cron verifica (ve updated_at reciente, skip)
- `T+50min`: Frontend actualiza token
- `T+58min`: Backend cron verifica (ve updated_at reciente, skip)
- Usuario cierra ventana en T+60min
- `T+87min`: Backend cron verifica (ve updated_at > 30min, actualiza)
- **Token se mantiene vivo para pre-reservas automáticas**

### Cookie Management

**Importante**: Cada llamada a tokenUpdate devuelve nuevas cookies.

**Strategy**:
1. Backend guarda cookies en BBDD
2. Frontend llama a `GET /api/auth/session` para obtenerlas
3. Frontend actualiza localStorage con nueva data
4. Backend usa cookies de BBDD para futuras llamadas

## Technical Decisions

### Frontend Timing: 25 minutes
**Razón**: Dar margen de 5 min antes de expiración (~30 min) para evitar timeouts

### Backend Timing: 29 minutes
**Razón**:
- Backup del frontend
- Solo actúa si frontend no actualizó (>30 min sin update)
- Mantiene sesión viva para pre-reservas cuando usuario no está

### Cookie Management: DB + Sync Endpoint
**Razón**:
- Cookies guardadas en BBDD
- Frontend las obtiene via endpoint seguro
- No intentar setear HttpOnly cookies desde JS (no funciona)

### Session Endpoint Security: HttpOnly Cookie
**Razón**:
- No expone email en URL
- Cookie HttpOnly no accesible desde JS malicioso
- Estándar de seguridad web
- Simple de implementar

### GitHub Actions for Cron
**Razón**:
- No requiere servidor adicional
- Integrado con repo
- Fácil de monitorear y debuggear
- Free tier generoso

## Architecture Plan

### File Structure
```
Frontend:
├── common/services/token-refresh.service.ts (NEW)
├── modules/auth/hooks/useTokenRefresh.hook.tsx (NEW)
└── modules/auth/context/AuthContext.tsx (MODIFY)

Backend:
├── app/api/auth/token-update/route.ts (NEW)
├── app/api/auth/session/route.ts (NEW)
├── modules/auth/api/services/token-update.service.ts (NEW)
├── modules/auth/api/services/aimharder-refresh.service.ts (MODIFY)
└── .github/workflows/refresh-tokens.yml (NEW)
```

### Integration Points

1. **AuthContext**:
   - Integrate token refresh hook
   - Handle session sync on mount
   - Manage refresh timer lifecycle

2. **Login flow**:
   - Start refresh timer after login
   - Store initial refreshToken in localStorage

3. **Logout flow**:
   - Stop refresh timer
   - Clear localStorage
   - Call backend logout

4. **Page Reload**:
   - Fetch latest session from DB
   - Sync localStorage
   - Restart timer from 0

5. **Session Cookie**:
   - Set HttpOnly cookie on login
   - Use for authenticating `/api/auth/session` calls
   - Clear on logout

## Questions for Subagents

### For nextjs-architect:
1. ¿Cuál es la mejor estructura para los endpoints `/api/auth/token-update` y `/api/auth/session`?
2. ¿Cómo implementar y gestionar las HttpOnly cookies de sesión en Next.js App Router?
3. ¿Cómo estructurar el GitHub Actions workflow para llamar al endpoint de refresh?
4. ¿Dónde guardar las credenciales/secrets para el cron (SUPABASE_URL, etc)?
5. ¿Cómo manejar la sincronización entre localStorage y server state de manera óptima?
6. ¿Estrategia para testing del cron job localmente?

### For frontend-test-engineer:
1. ¿Qué casos de prueba deberíamos considerar para el token refresh?
2. ¿Cómo mockear los timers de setInterval/setTimeout en tests?
3. ¿Estrategia para testing de sincronización en page reload?
4. ¿Cómo testear el flujo completo: login → refresh → logout?
5. ¿Edge cases a considerar (tab visibility, network errors, concurrent updates)?

## Implementation Phases

### Phase 1: Backend Implementation
1. Create `POST /api/auth/token-update` endpoint
2. Create `GET /api/auth/session` endpoint with HttpOnly cookie auth
3. Modify `aimharder-refresh.service` to support tokenUpdate call
4. Update `supabase-session.service` for token updates
5. Implement session cookie management

### Phase 2: Frontend Implementation
1. Create `token-refresh.service.ts`
2. Create `useTokenRefresh.hook.tsx`
3. Modify `AuthContext` to integrate refresh hook
4. Add session sync on page load
5. Update login flow to start refresh timer
6. Update logout flow to stop refresh timer

### Phase 3: GitHub Actions Cron
1. Create `.github/workflows/refresh-tokens.yml`
2. Create API endpoint for cron to call: `POST /api/cron/refresh-tokens`
3. Implement token refresh logic for all active sessions
4. Add monitoring and error tracking
5. Configure secrets in GitHub repo settings

### Phase 4: Testing & Validation
1. Unit tests for services and hooks
2. Integration tests for flows
3. Manual testing with real Aimharder API
4. Test cron job execution
5. QA validation with qa-criteria-validator

## ⚠️ CRITICAL: KISS Principle for Subagents

**Instrucciones para los subagentes:**
- ✅ Reutilizar TODO lo que ya existe
- ✅ Soluciones simples y directas
- ❌ NO crear abstracciones innecesarias
- ❌ NO sobreingeniería
- ❌ Solo lo ESENCIAL

**Sincronización CRÍTICA:**
Cada actualización de token DEBE actualizar en DB:
1. `aimharder_token` (refreshToken)
2. `aimharder_cookies` (cookies actualizadas)
3. `updated_at` (timestamp)
4. Frontend debe poder leer estos valores sincronizados

## Simplified Questions for Subagents

### For nextjs-architect:
**IMPORTANTE: Aplicar KISS - reutilizar servicios existentes, no crear cosas nuevas innecesarias**

1. ¿Cómo estructurar `POST /api/auth/token-update` reutilizando aimharder-refresh.service y supabase-session.service?
2. ¿GitHub Actions cron workflow mínimo para llamar al endpoint cada 29 min?
3. ¿Dónde guardar secrets y cómo pasarlos al endpoint?
4. ¿Endpoint separado para cron o reutilizar el mismo?
5. ¿Cómo sincronizar cookies + refreshToken entre frontend localStorage y DB después de cada update?

### For frontend-test-engineer:
**IMPORTANTE: Tests mínimos esenciales, no suite exhaustiva**

1. Tests básicos para timer de 25 min (mock setInterval)
2. Test de actualización localStorage después de refresh
3. Test de cleanup del timer
4. ¿Algún edge case crítico que DEBAMOS cubrir?

## ✅ FINAL APPROVED APPROACH

### Decision: localStorage + DB (como Aimharder)

**Razón**: Compatibilidad probada, menos riesgo, funciona igual que el sistema original.

**Sincronización Simplificada:**
```typescript
// Solo 2 momentos de sync:
1. Después de cada token update → guardar en localStorage + DB (backend)
2. Page reload → leer directamente de localStorage (ya está sincronizado)
```

**NO necesitamos:**
- ❌ GET /api/auth/session para sincronizar en cada reload
- ❌ Verificación constante DB vs localStorage
- ❌ Lógica compleja de sincronización

**Flujo Simple:**
```
1. Timer 25 min → llama API con token de localStorage
2. Backend actualiza DB (token + cookies)
3. Backend responde con newToken
4. Frontend actualiza localStorage
5. DB y localStorage quedan sincronizados automáticamente
```

## ✅ IMPLEMENTATION COMPLETED

### Phase 1: Backend ✅
1. **Modified**: `modules/auth/api/services/aimharder-refresh.service.ts`
   - Added `updateToken()` method
   - Calls Aimharder `/api/tokenUpdate`
   - Extracts newToken and cookies from response

2. **Created**: `app/api/auth/token-update/route.ts`
   - POST endpoint for frontend
   - Receives: `{ email, token, fingerprint }`
   - Updates DB with new token + cookies
   - Returns: `{ newToken }` or `{ logout: true }`

### Phase 2: Frontend ✅
1. **Created**: `modules/auth/hooks/useTokenRefresh.hook.tsx`
   - Timer de 25 minutos
   - Llama a `/api/auth/token-update`
   - Actualiza localStorage con newToken
   - Cleanup automático

2. **Modified**: `modules/auth/pods/login/hooks/useLogin.hook.tsx`
   - Integra `useTokenRefresh` hook
   - Inicia timer después de login exitoso
   - Detiene timer en logout
   - Reinicia timer en checkAuthStatus si hay sesión válida

### Phase 3: GitHub Actions Cron ✅
1. **Created**: `.github/workflows/refresh-tokens.yml`
   - Cron cada 29 minutos
   - Llama a endpoint seguro

2. **Created**: `app/api/cron/refresh-tokens/route.ts`
   - POST endpoint con autenticación
   - Procesa todas las sesiones activas
   - Solo actualiza si `updated_at` > 30 min
   - Tracking de éxitos/fallos

## Next Steps for Deployment

### 1. Configure GitHub Secrets
Add these secrets in GitHub repo settings (if not already set):
```
CRON_SECRET=<your-existing-cron-secret>
APP_URL=https://your-app-url.com
```

**Note**: Using the same `CRON_SECRET` for all cron jobs (prebooking + token refresh)

### 2. Configure Environment Variables
Already configured in `.env.example`:
```
CRON_SECRET=<same-as-github-secret>
AIMHARDER_FINGERPRINT=<default-fingerprint-for-backend>
APP_URL=<your-production-url>
```

### 3. Manual Testing
```bash
# Test token update endpoint (user-facing)
curl -X POST http://localhost:3000/api/auth/token-update \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","token":"xxx","fingerprint":"xxx"}'

# Test cron endpoint (backend-only)
curl -X POST http://localhost:3000/api/cron/refresh-tokens \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 4. Monitor in Production
- Check GitHub Actions runs
- Monitor logs for token updates
- Verify DB updates in Supabase

---

## Frontend Test Engineer Report - ✅ COMPLETED

### Testing Strategy Summary (KISS Applied)

**Documentation**: `.claude/doc/token_refresh/frontend-test-engineer.md`

**Total Tests**: ~10 essential tests (not 50+)
**Coverage Goal**: 60%+ (focused on critical paths)
**Time Estimate**: 2-3 hours

### Essential Test Cases Defined

#### 1. Core Functionality (5 tests)
1. ✅ Timer calls API after 25 minutes
2. ✅ Updates localStorage with new token
3. ✅ Cleanup timer on unmount
4. ✅ Logout user if API returns logout flag
5. ✅ No timer start if no refreshToken

#### 2. Critical Edge Cases (2 tests)
1. ✅ Network failure handling (no app crash)
2. ✅ Multiple timer prevention (memory leak)

#### 3. Integration Tests (2 tests)
1. ✅ Timer starts after login (AuthContext)
2. ✅ Timer stops after logout (AuthContext)

### Mock Strategy Provided

```typescript
// Timer mocking
vi.useFakeTimers()
vi.advanceTimersByTime(25 * 60 * 1000)

// API mocking
vi.mock('@/common/services/token-refresh.service')

// localStorage mocking
vi.spyOn(Storage.prototype, 'setItem')
```

### What We're NOT Testing (YAGNI)
- ❌ Timer precision (±1s doesn't matter)
- ❌ localStorage API itself (browser feature)
- ❌ Multiple tab sync (not in requirements)
- ❌ Token validation (backend job)
- ❌ Cookie parsing (service responsibility)

### Critical Failures Prevented
1. **Memory leak** from timer not clearing
2. **Duplicate API calls** from multiple timers
3. **App crash** on network failure
4. **Session stuck** if logout flag ignored
5. **Timer runs forever** if logout not called

### Test Files to Create
```
modules/auth/
├── hooks/__tests__/
│   └── useTokenRefresh.test.tsx (8 tests)
└── context/__tests__/
    └── AuthContext.token-refresh.test.tsx (2 tests)
```

### Acceptance Criteria
- [ ] All 10 tests implemented and passing
- [ ] No console errors in test output
- [ ] Coverage > 60% on tested files
- [ ] Manual smoke test in browser confirms timer works

### Ready for Implementation Phase 2
Tests defined, mock strategies clear, implementation can proceed with confidence.

## Key Clarifications from Discussion

1. ✅ **Cron**: GitHub Actions, every 29 minutes
2. ✅ **Frontend timing**: 25 minutes
3. ✅ **Page reload**: Always sync with DB first
4. ✅ **Cookies**: Store in DB, fetch via secure endpoint
5. ✅ **Security**: HttpOnly cookie authentication (Opción A)
6. ✅ **Priority**: User experience first, backend backup for pre-reservas
7. ✅ **No conflict cancellation**: Frontend updates regardless of backend state