# 🔍 Análisis de Causa Raíz - Bug de Timezone en Prebookings

## 📊 El Problema Observado

**En local:** Clase a 08:00 → Prebooking muestra 08:00 ✅
**En prod:** Clase a 08:00 → Prebooking muestra 09:00 ❌

Diferencia: **+1 hora en producción**

---

## 🔎 Flujo de Datos - Análisis Completo

### PASO 1: Frontend Extrae Datos del Booking
**Archivo:** `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx` (línea 136-137)

```typescript
const booking = bookingDay.bookings.find((b) => b.id === bookingId);
const classTime = booking?.timeSlot.startTime || booking?.timeSlot.time;
```

**Fuente de datos:**
- `booking.timeSlot.startTime` viene del mapper
- El mapper extrae de `bookingApi.time` que viene de la API de AimHarder

### PASO 2: Mapper Parse el Tiempo
**Archivo:** `modules/booking/api/mappers/booking.mapper.ts` (línea 101-122)

```typescript
const timeParts = bookingApi.time.includes(' - ')
  ? bookingApi.time.split(' - ')
  : bookingApi.time.includes('-')
  ? bookingApi.time.split('-')
  : [bookingApi.time, bookingApi.time];

const startTime = timeParts[0]?.trim() || '';
const endTime = timeParts[1]?.trim() || '';
```

**Observación:** El mapper ahora es defensivo y maneja múltiples formatos.
**Posible problema:** ¿En prod la API retorna diferente formato?

### PASO 3: Frontend Convierte a UTC
**Archivo:** `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx` (línea 174-183)

```typescript
let classTimeUTC: string | undefined;
if (classTime) {
  classTimeUTC = convertLocalToUTC(apiDate, classTime);
  console.log('[BOOKING-FRONTEND] Converted class time:', {
    apiDate,
    classTime,
    classTimeUTC,
    browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    currentOffset: new Date().getTimezoneOffset(),
  });
}
```

**Función:** `convertLocalToUTC()` de `common/utils/timezone.utils.ts`
**Qué hace:** Usa `fromZonedTime()` de date-fns-tz para convertir a UTC

### PASO 4: Frontend Envía al Backend
**Archivo:** `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx` (línea 203-227)

```typescript
const bookingRequest = {
  day: apiDate,
  familyId: "",
  id: bookingId.toString(),
  insist: 0,
  classTimeUTC,        // ← AQUÍ SE ENVÍA EL VALOR EN UTC
  activityName: booking?.class?.name || "Clase",
  boxName: booking?.box.name,
  boxId: boxId,
  boxSubdomain: boxData.subdomain,
  boxAimharderId: boxData.box_id,
};

console.log('[BOOKING-FRONTEND] Sending booking request:', {
  ...bookingRequest,
  classTimeUTCPresent: !!classTimeUTC,
});

const response = await fetch("/api/booking", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(currentUserEmail && { "x-user-email": currentUserEmail }),
  },
  body: JSON.stringify(bookingRequest),  // ← SE SERIALIZA AQUÍ
});
```

**Crítico:** Verificar que `classTimeUTC` es un string ISO válido cuando se serializa

### PASO 5: Backend Recibe y Parsea
**Archivo:** `app/api/booking/route.ts` (línea 199-313)

```typescript
const classTimeUTC = body.classTimeUTC; // Extrae el string ISO

console.log('[BOOKING-BACKEND] Received booking request:', {
  day: body.day,
  classTimeUTC,
  classTimeUTCType: typeof classTimeUTC,
  classTimeUTCPresent: !!classTimeUTC,
  boxId,
  boxSubdomain,
});

// ... línea 290-313: Parsea el string a Date

let classTimeUTCDate: Date | undefined;
if (classTimeUTC && typeof classTimeUTC === 'string') {
  try {
    classTimeUTCDate = new Date(classTimeUTC);
    if (isNaN(classTimeUTCDate.getTime())) {
      console.warn('[BOOKING] Invalid classTimeUTC format:', classTimeUTC);
      classTimeUTCDate = undefined;
    } else {
      console.log('[BOOKING] Successfully parsed classTimeUTC:', {
        original: classTimeUTC,
        parsed: classTimeUTCDate.toISOString(),
        utcHours: classTimeUTCDate.getUTCHours(),
        utcMinutes: classTimeUTCDate.getUTCMinutes(),
      });
    }
  } catch (error) {
    console.warn('[BOOKING] Error parsing classTimeUTC:', error);
    classTimeUTCDate = undefined;
  }
} else {
  console.warn('[BOOKING] classTimeUTC not provided or invalid type:', {
    value: classTimeUTC,
    type: typeof classTimeUTC,
  });
}
```

**Crítico:** Si el parsing falla o `classTimeUTC` no se envía, `classTimeUTCDate` será `undefined`

### PASO 6: Backend Calcula `availableAt`
**Archivo:** `app/api/booking/route.ts` (línea 315-319)

```typescript
const parsed = parseEarlyBookingError(
  bookingResponse.errorMssg,
  validatedRequest.data.day,
  classTimeUTCDate // ← AQUÍ PASA LA DATE O UNDEFINED
);

console.log('[BOOKING] parseEarlyBookingError result:', {
  errorMessage: bookingResponse.errorMssg,
  classDay: validatedRequest.data.day,
  classTimeUTCProvided: !!classTimeUTCDate,
  parsedAvailableAt: parsed?.availableAt.toISOString(),
  parsedDaysAdvance: parsed?.daysAdvance,
  parsedClassDate: parsed?.classDate.toISOString(),
});
```

### PASO 7: Error Parser Calcula Hora de Disponibilidad
**Archivo:** `modules/prebooking/utils/error-parser.utils.ts` (línea 55-86)

```typescript
if (classTimeUTC && classTimeUTC instanceof Date && !isNaN(classTimeUTC.getTime())) {
  classDateUTC = classTimeUTC;
  console.log('[PreBooking] Using provided classTimeUTC:', {
    classTimeUTC: classTimeUTC.toISOString(),
    utcHours: classTimeUTC.getUTCHours(),
    utcMinutes: classTimeUTC.getUTCMinutes(),
  });
} else {
  // ⚠️ FALLBACK: SI classTimeUTC ES UNDEFINED, USA 00:00 UTC
  console.warn('[PreBooking] No valid classTimeUTC provided, using 00:00 UTC for classDay', {
    classTimeUTCProvided: !!classTimeUTC,
    classTimeUTCType: classTimeUTC?.constructor?.name,
    classTimeUTCValid: classTimeUTC instanceof Date ? !isNaN(classTimeUTC.getTime()) : false,
  });
  const classDateParsed = parseDateFromYYYYMMDD(classDay);
  if (!classDateParsed) {
    console.error('[PreBooking] Invalid class date format:', classDay);
    return null;
  }
  classDateUTC = new Date(Date.UTC(
    classDateParsed.getFullYear(),
    classDateParsed.getMonth(),
    classDateParsed.getDate(),
    0,  // ← 00:00 UTC
    0,
    0
  ));
  console.log('[PreBooking] Created fallback UTC date:', {
    classDateUTC: classDateUTC.toISOString(),
  });
}

const availableAt = sub(classDateUTC, { days: daysAdvance });
```

**⚠️ CRÍTICO:** Si `classTimeUTC` es undefined, usa fallback `00:00 UTC` en lugar de la hora real

### PASO 8: Frontend Muestra `availableAt`
**Archivo:** `modules/prebooking/pods/my-prebookings/components/PrebookingCard.component.tsx` (línea 52-61)

```typescript
const formattedDate = prebooking.availableAt.toLocaleDateString("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const formattedTime = prebooking.availableAt.toLocaleTimeString("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
});
```

**⚠️ PROBLEMA ENCONTRADO:**
`toLocaleTimeString()` usa el **timezone local del navegador**, no UTC

---

## 🎯 HIPÓTESIS DE LA CAUSA

### Escenario en Producción (Oct 24, 2025):

1. **Frontend calcula:** `classTimeUTC = "2025-10-24T06:00:00.000Z"` ✅
   - Oct 24 está en CEST (UTC+2)
   - 08:00 CEST = 06:00 UTC

2. **¿Se envía al backend?**
   - LOG en navegador dice que SÍ
   - Pero ¿qué tipo de navegador/timezone en prod?

3. **Backend recibe y parsea:**
   - Si recibe la fecha correctamente → `classTimeUTCDate` = `2025-10-24T06:00:00.000Z` ✅
   - Si NO recibe → `classTimeUTCDate` = `undefined` ❌ → USA FALLBACK 00:00 UTC

4. **Calcula availableAt:**
   - Si classTimeUTC correcto: `availableAt = 2025-10-20T06:00:00.000Z`
   - Si fallback: `availableAt = 2025-10-20T00:00:00.000Z` ← **DIFERENCIA DE 6 HORAS**

5. **Frontend muestra:**
   - `availableAt.toLocaleTimeString()` en navegador local
   - **En Madrid local (UTC+2):** `06:00 UTC` → muestra `08:00` ✅
   - **En Madrid prod (UTC+1?):** `06:00 UTC` → muestra `07:00` ❌ (NO ES 09:00 AÚN)

---

## 🤔 ¿POR QUÉ MUESTRA 09:00 EN PROD?

Hay dos posibilidades:

### Opción A: El navegador en prod está en diferente timezone
Si el servidor/navegador en prod está en **UTC+3 o algo similar**:
- `06:00 UTC` se mostraría como `09:00` ✅

### Opción B: `classTimeUTC` NO se está enviando
- Se usa fallback `00:00 UTC`
- Pero entonces en Madrid local sería `01:00` o `02:00`, no `09:00`
- A menos que... el fallback se reste incorrectamente

### Opción C: `classTimeUTC` se envía pero se parsea mal
- Se recibe como string: `"2025-10-24T06:00:00.000Z"`
- Se parsea como: `new Date("2025-10-24T06:00:00.000Z")`
- Pero ¿qué si el parsing agrega una hora extra en prod?

---

## 📋 ACCIONES INMEDIATAS

### 1. Revisar Logs en Producción
Cuando ocurra el error, buscar:

```
[BOOKING-FRONTEND] Booking data: { startTime, time, classTime }
[BOOKING-FRONTEND] Converted class time: { classTimeUTC }
[BOOKING-FRONTEND] Sending booking request: { classTimeUTC }
[BOOKING-BACKEND] Received booking request: { classTimeUTC }
[BOOKING] Successfully parsed classTimeUTC: { utcHours }
[PreBooking] Using provided classTimeUTC: { classTimeUTC }
```

### 2. Si Falta algún Log
Significa que `classTimeUTC` NO se está enviando/recibiendo → Fallback a `00:00 UTC`

### 3. Si Todos los Logs Están Presentes
Significa que el problema está en cómo se muestra (`toLocaleTimeString()` con timezone diferente)

---

## 🔧 SOLUCIONES PROPUESTAS

### Solución 1: Formatear Manualmente sin timezone
En lugar de `toLocaleTimeString()`, usar UTC explícitamente:

```typescript
const formattedTime = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",  // ← FUERZA UTC
}).format(prebooking.availableAt);
```

**Ventaja:** No depende del timezone del navegador
**Desventaja:** Muestra UTC, no hora local (¿queremos eso?)

### Solución 2: Usar `convertUTCToLocal()` primero
En lugar de formatear UTC directamente, convertir primero:

```typescript
import { convertUTCToLocal } from '@/common/utils/timezone.utils';

const localDateTime = convertUTCToLocal(prebooking.availableAt.toISOString());
const formattedTime = localDateTime.toLocaleTimeString("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
});
```

**Ventaja:** Muestra hora local correcta del usuario
**Desventaja:** Necesita que `convertUTCToLocal()` funcione bien

### Solución 3: Verificar que `classTimeUTC` se envía
Agregar más logs y validaciones en el frontend para asegurar que:
1. `classTime` se extrae correctamente
2. `classTimeUTC` se convierte correctamente
3. `classTimeUTC` está en el body cuando se serializa

---

## 📝 Conclusión Temporal

**El bug probablemente está en una de estas 3 causas:**

1. ❌ `classTime` se extrae como undefined en prod
2. ❌ `classTimeUTC` no se envía/recibe en prod (usa fallback)
3. ✅ `classTimeUTC` se calcula correctamente pero se muestra con timezone incorrecto

**Siguiente paso:** Revisar los logs en producción cuando ocurra el error.
