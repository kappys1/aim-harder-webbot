# Verificación: ¿Se Está Haciendo al Dominio Correcto?

## Respuesta: ✅ SÍ, definitivamente se está usando el dominio correcto

Aquí te muestro el flujo completo desde que el usuario hace login hasta que se hace la reserva:

---

## 📊 Flujo Completo de la Reserva

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USUARIO LOGIN (frontend PWA)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Usuario ingresa: email + password                                │
│ ↓                                                                 │
│ Calls: authService.login(email, password)                       │
│ ↓                                                                 │
│ Sends: /api/auth/aimharder (POST)                               │
│        {                                                          │
│          "email": "lguerr12@xtec.cat",                          │
│          "password": "***",                                       │
│          "fingerprint": "browser-fingerprint-123"                │
│        }                                                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. BACKEND AUTH (/api/auth/aimharder)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ✅ Calls AimHarder login API (EXTERNAL)                         │
│    - No specific domain needed, just the credentials             │
│                                                                   │
│ ✅ Gets response:                                                │
│    {                                                              │
│      "user": { "email": "lguerr12@xtec.cat", ... },            │
│      "token": "auth-token-xyz",                                  │
│      "cookies": [PHPSESSID, AWSALB, amhrdrauth, ...] ← KEY!   │
│    }                                                              │
│                                                                   │
│ ✅ Stores in Supabase auth_sessions:                            │
│    {                                                              │
│      user_email: "lguerr12@xtec.cat",                           │
│      fingerprint: "browser-fingerprint-123",                    │
│      token: "auth-token-xyz",                                    │
│      cookies: [...],  ← These cookies are linked to the        │
│      created_at: now   session but NOT to a specific box        │
│    }                                                              │
│                                                                   │
│ ✅ Returns to frontend: email, token                            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. FRONTEND STORES USER INFO (PWA)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ localStorage.setItem("user-email", "lguerr12@xtec.cat")        │
│ localStorage.setItem("fingerprint", "browser-fingerprint-123") │
│                                                                   │
│ Redirect to /dashboard                                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. USUARIO SELECCIONA SU BOX (frontend PWA)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ User selects: "Box Cerdanyola" or "Other Box"                  │
│ ↓                                                                 │
│ boxId = "uuid-of-selected-box"                                  │
│ ↓                                                                 │
│ URL query param: /booking?boxId=uuid-of-selected-box           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. FRONTEND FETCHES BOOKINGS (GET /api/booking)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Sends request:                                                   │
│   GET /api/booking?day=20251027&boxId=uuid-of-box              │
│   Header: x-user-email: lguerr12@xtec.cat                      │
│                                                                   │
│ 🔑 KEY: The boxId tells the backend WHICH BOX'S DATA to fetch  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. BACKEND GETS BOX DETAILS (app/api/booking/route.ts:GET)    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Receives: boxId = "uuid-of-selected-box"                       │
│ ↓                                                                 │
│ ✅ Fetches from Supabase (boxes table):                         │
│    SELECT * FROM boxes WHERE id = 'uuid-of-selected-box'      │
│    ↓                                                              │
│    Returns:                                                       │
│    {                                                              │
│      id: "uuid-of-selected-box",                               │
│      subdomain: "crossfitcerdanyola300",  ← BOX-SPECIFIC!     │
│      base_url: "https://crossfitcerdanyola300.aimharder.com", │
│      box_id: "aimharder-box-id-123",                           │
│      ...                                                          │
│    }                                                              │
│                                                                   │
│ ✅ Uses THIS subdomain to build the external API URL:          │
│    const baseUrl = box.base_url;                               │
│    const targetUrl = new URL("/api/bookings", baseUrl);       │
│    ↓                                                              │
│    Results in:                                                    │
│    https://crossfitcerdanyola300.aimharder.com/api/bookings  │
│                                                                   │
│ ✅ Makes request to CORRECT DOMAIN with user's cookies         │
│    fetch(targetUrl, {                                           │
│      headers: {                                                  │
│        Cookie: session.cookies, ← FROM SUPABASE SESSION        │
│        ...                                                        │
│      }                                                            │
│    })                                                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. AIMHARDER RETURNS BOOKINGS (external API response)           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ AimHarder sees:                                                  │
│   - User's cookies (which they issued during login)             │
│   - Subdomain: crossfitcerdanyola300 ← Identifies WHICH BOX   │
│ ↓                                                                 │
│ Returns bookings for that specific box                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. FRONTEND SHOWS BOOKINGS & USER CLICKS "RESERVAR" (PWA)      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ User clicks booking button                                       │
│ ↓                                                                 │
│ Frontend fetches box details:                                    │
│   GET /api/boxes/uuid-of-selected-box?email=lguerr12@xtec.cat │
│ ↓                                                                 │
│ Gets back:                                                        │
│   {                                                               │
│     "box": {                                                      │
│       subdomain: "crossfitcerdanyola300",  ← CRITICAL!        │
│       box_id: "aimharder-box-id-123",                          │
│       ...                                                         │
│     }                                                             │
│   }                                                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. FRONTEND MAKES BOOKING REQUEST (POST /api/booking)          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Sends:                                                            │
│   POST /api/booking                                             │
│   Header: x-user-email: lguerr12@xtec.cat                      │
│   Body: {                                                         │
│     day: "20251027",                                            │
│     id: "slot-id-456",                                          │
│     insist: 0,                                                   │
│     boxId: "uuid-of-selected-box",        ← 1. Which box      │
│     boxSubdomain: "crossfitcerdanyola300", ← 2. Which domain  │
│     boxAimharderId: "aimharder-box-id-123", ← 3. Which AH ID  │
│     familyId: "",                                                │
│     classTimeUTC: "2025-10-27T07:00:00Z"                       │
│   }                                                               │
│                                                                   │
│ 🔑 KEY: Frontend provides BOTH boxId AND boxSubdomain         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 10. BACKEND VALIDATES (POST /api/booking - NEW FIX!)            │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ✅ NEW FIX #1: Validate user email header is present             │
│    if (!userEmail) return 400 "Missing x-user-email"            │
│                                                                    │
│ ✅ NEW FIX #2: Validate user has access to this box             │
│    hasAccess = await BoxAccessService.validateAccess(           │
│      userEmail: "lguerr12@xtec.cat",                            │
│      boxId: "uuid-of-selected-box"                              │
│    )                                                              │
│    Query: SELECT * FROM user_boxes                              │
│            WHERE user_email='lguerr12@xtec.cat'                │
│            AND box_id='uuid-of-selected-box'                   │
│    If no row → return 403 "Access denied"                       │
│                                                                    │
│ ✅ NEW FIX #3: Validate subdomain matches database              │
│    box = await BoxService.getBoxById(boxId)                    │
│    if (box.subdomain !== boxSubdomain) {                        │
│      return 400 "Invalid box subdomain"                         │
│    }                                                              │
│    ↓                                                               │
│    Ensures frontend can't send wrong subdomain                  │
│                                                                    │
│ ✅ Get device session from Supabase:                            │
│    session = await SupabaseSessionService.getDeviceSession(    │
│      "lguerr12@xtec.cat"                                        │
│    )                                                              │
│    Gets: { cookies: [...], token: "...", ... }                │
│                                                                    │
│ ✅ Refresh token if >25 minutes old:                            │
│    if (token age > 25 minutes) {                                │
│      refresh token via AimHarder API                            │
│    }                                                              │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 11. BACKEND CALLS BOOKING SERVICE (booking.service.ts)          │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│ Calls: bookingService.createBooking(                            │
│   request: { day: "20251027", id: "456", ... },               │
│   cookies: [...],  ← FROM SUPABASE SESSION                     │
│   boxSubdomain: "crossfitcerdanyola300"  ← FROM REQUEST BODY  │
│ )                                                                  │
│                                                                    │
│ Inside service:                                                   │
│   ✅ const baseUrl = `https://crossfitcerdanyola300.aimharder.com` │
│   ✅ const url = `${baseUrl}/reserva`;                          │
│                                                                    │
│   fetch(url, {                                                    │
│     method: "POST",                                              │
│     headers: {                                                    │
│       Cookie: formatCookies(cookies),  ← USER'S SESSION         │
│       Origin: baseUrl,  ← MATCHES DOMAIN                        │
│       Referer: `${baseUrl}/`,  ← MATCHES DOMAIN                 │
│       ...                                                         │
│     },                                                            │
│     body: URLSearchParams({                                      │
│       day: "20251027",                                           │
│       id: "456",                                                 │
│       ...                                                         │
│     })                                                            │
│   })                                                              │
│                                                                    │
│ 🔑 KEY: The URL is built from boxSubdomain parameter            │
│         which was validated against database                     │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 12. AIMHARDER PROCESSES BOOKING (external API)                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│ AimHarder receives:                                              │
│   POST https://crossfitcerdanyola300.aimharder.com/reserva      │
│   Headers:                                                        │
│     Cookie: PHPSESSID=abc123; AWSALB=xyz789; ...               │
│     Origin: https://crossfitcerdanyola300.aimharder.com         │
│   Body:                                                           │
│     day=20251027&id=456&familyId=&insist=0                    │
│                                                                    │
│ AimHarder checks:                                                │
│   1. Is the user logged in? (checks cookies)                    │
│   2. Does user have access to crossfitcerdanyola300 box?       │
│   3. Are the credentials valid?                                 │
│ ↓                                                                 │
│ If all good: Creates booking, returns { bookState: 1, id: ... }│
│ If problem: Returns { bookState: -1, errorMsg: "..." }        │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 13. FRONTEND SHOWS RESULT (PWA)                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│ If success: toast.success("Reserva exitosa")                    │
│ If error: toast.error("Error: " + error message)                │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## ✅ Puntos Críticos Donde Se Valida el Dominio

### 1. **Backend GET /api/booking** (Línea 144)
```typescript
const baseUrl = box.base_url; // e.g., https://crossfitcerdanyola300.aimharder.com
const targetUrl = new URL("/api/bookings", baseUrl);
// Result: https://crossfitcerdanyola300.aimharder.com/api/bookings
```
✅ **Viene de la BD, no del usuario**

### 2. **Backend POST /api/booking** (Línea 293-307)
```typescript
// NEW FIX: Validate subdomain matches database
const box = await BoxService.getBoxById(boxId);
if (box.subdomain !== boxSubdomain) {
  return 400 "Invalid box subdomain"
}
```
✅ **Ahora valida que el subdomain del usuario coincida con la BD**

### 3. **BookingService.createBooking** (Línea 112)
```typescript
const baseUrl = `https://${boxSubdomain}.aimharder.com`;
const url = `${baseUrl}${BOOKING_CONSTANTS.API.ENDPOINTS.CREATE_BOOKING}`;
```
✅ **El boxSubdomain ya fue validado en el paso anterior**

---

## 🔄 Comparación: User 1 (Cerdanyola) vs User 2 (Other Box)

### **USER 1: Cerdanyola (FUNCIONA)**

```
1. Login: email = alexsbd1@gmail.com ✅
2. Selects box: boxId = "uuid-cerdanyola" ✅
3. GET /api/booking:
   - Query: SELECT * FROM boxes WHERE id = "uuid-cerdanyola"
   - Returns: subdomain = "crossfitcerdanyola300" ✅
   - Calls: https://crossfitcerdanyola300.aimharder.com/api/bookings ✅
4. POST /api/booking:
   - Validates boxId in user_boxes: ✅ (tiene acceso)
   - Validates subdomain: "crossfitcerdanyola300" == DB value ✅
   - Calls: https://crossfitcerdanyola300.aimharder.com/reserva ✅
5. AimHarder checks cookies: ✅ (user logged into cerdanyola)
6. Booking created: ✅
```

### **USER 2: Other Box (ANTES FALLABA, AHORA DEBE FUNCIONAR)**

**ANTES (con bug):**
```
1. Login: email = lguerr12@xtec.cat ✅
2. Selects box: boxId = "uuid-other-box" ✅
3. GET /api/booking:
   - Header missing?: x-user-email fallback to "alexsbd1@gmail.com" ❌
   - Query: SELECT * FROM boxes WHERE id = "uuid-other-box"
   - Returns: subdomain = "other-box-subdomain"
   - Gets session for "alexsbd1@gmail.com" (WRONG USER!) ❌
   - Cookies are for cerdanyola, not other-box ❌
   - Calls: https://other-box-subdomain.aimharder.com/api/bookings ✅ (domain correcto)
   - But cookies are wrong! ❌
   - AimHarder rejects: "Forbidden" ❌
4. Error: "Error de conexión" ❌
```

**DESPUÉS (con fixes):**
```
1. Login: email = lguerr12@xtec.cat ✅
2. Selects box: boxId = "uuid-other-box" ✅
3. GET /api/booking:
   - Header check: x-user-email = "lguerr12@xtec.cat" ✅ (NEW FIX)
   - Access validation: user_boxes has entry for this box ✅ (NEW FIX)
   - Query: SELECT * FROM boxes WHERE id = "uuid-other-box"
   - Returns: subdomain = "other-box-subdomain" ✅
   - Gets session for "lguerr12@xtec.cat" ✅ (CORRECT USER)
   - Cookies are for other-box ✅
   - Calls: https://other-box-subdomain.aimharder.com/api/bookings ✅
4. POST /api/booking:
   - Header check: x-user-email = "lguerr12@xtec.cat" ✅ (NEW FIX)
   - Access validation: user has access to this box ✅ (NEW FIX)
   - Subdomain validation: "other-box-subdomain" == DB value ✅ (NEW FIX)
   - Gets session for correct user ✅
   - Calls: https://other-box-subdomain.aimharder.com/reserva ✅
5. AimHarder checks cookies: ✅ (user logged into other-box)
6. Booking created: ✅
```

---

## 📌 Resumen: SÍ, el dominio es CORRECTO

### ✅ El dominio se obtiene de:

1. **Frontend obtiene boxId** → URL parameter o localStorage
2. **Backend fetch box from DB** → `boxes` table where `id = boxId`
3. **Get subdomain** → `box.subdomain` field
4. **Build URL** → `https://${box.subdomain}.aimharder.com`
5. **NEW FIX #3**: Validate que el subdomain del usuario coincida con el de la BD

### ✅ El problema NO era el dominio sino:

1. ❌ Email hardcodeado → Si faltaba header, todos usaban la misma sesión
2. ❌ Falta de acceso validación → No se verificaba que el usuario tuviera acceso
3. ❌ Sin validación de subdomain → Backend no verificaba que coincidiera con BD
4. ❌ Cookies equivocadas → User 2 obtenía cookies de User 1 por fallback de email

### ✅ Con los fixes ahora:

1. ✅ Emails siempre correctos (validado en frontend)
2. ✅ Acceso validado en POST y GET
3. ✅ Subdomain validado contra BD
4. ✅ Cookies siempre correctas (sesión específica del usuario)

---

## 🧪 Cómo Verificar en los Logs del Servidor

Cuando haga una reserva, busca en los logs:

```
[BOOKING-POST] Received booking request: {
  day: "20251027",
  userEmail: "lguerr12@xtec.cat",        ← Correcto
  boxId: "uuid-other-box",                ← Correcto
  boxSubdomain: "other-box-subdomain",    ← Correcto
  classTimeUTC: "2025-10-27T07:00:00Z"
}

[BOOKING-POST] Received booking request: {
  day: "20251027",
  userEmail: "alexsbd1@gmail.com",        ← User 1
  boxId: "uuid-cerdanyola",               ← Cerdanyola
  boxSubdomain: "crossfitcerdanyola300",  ← Cerdanyola
  classTimeUTC: "2025-10-27T07:00:00Z"
}
```

Si ves dos logs con diferentes emails y dominios → ✅ ambos usuarios están usando sus dominios correctos.

---

**CONCLUSIÓN: Sí, el dominio es definitivamente correcto. El problema era la autenticación/sesión, no el routing.**
