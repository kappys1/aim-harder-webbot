# QStash Configuration Guide

## Overview

Este proyecto usa **QStash** de Upstash para ejecutar prebookings en el momento exacto (precisión <100ms) en lugar de usar cron-job.org con 1-10s de jitter.

**Costo**: $1.80/mes (~3000 mensajes/mes)

---

## Paso 1: Crear cuenta en Upstash

1. Ve a https://console.upstash.com
2. Crea una cuenta o inicia sesión
3. Ve a la sección **QStash**

---

## Paso 2: Seleccionar Plan Paid

⚠️ **IMPORTANTE**: El plan free solo permite 10 scheduled messages. Necesitas el plan paid.

1. Click en **"Billing"** o **"Upgrade"**
2. Selecciona **Pay as you go**
   - $0.60 por 1000 mensajes
   - Tu uso estimado: ~3000 mensajes/mes = **$1.80/mes**

---

## Paso 3: Obtener credenciales

En el dashboard de QStash, encontrarás 3 valores:

### 1. **QSTASH_TOKEN**
- Para publicar mensajes programados
- Formato: `eyJxxx...`
- Lo usas en el servidor para schedule/cancel

### 2. **QSTASH_CURRENT_SIGNING_KEY**
- Para verificar que requests vienen de QStash
- Formato: `sig_xxx...`
- Lo usas en el webhook endpoint

### 3. **QSTASH_NEXT_SIGNING_KEY**
- Para rotación de llaves
- Formato: `sig_xxx...`
- Lo usas en el webhook endpoint

---

## Paso 4: Configurar variables de entorno

### En desarrollo local (`.env.local`):

```bash
# QStash Configuration
QSTASH_TOKEN=eyJxxx...
QSTASH_CURRENT_SIGNING_KEY=sig_xxx...
QSTASH_NEXT_SIGNING_KEY=sig_xxx...

# App URL (para QStash callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### En producción (Vercel):

1. Ve a tu proyecto en https://vercel.com
2. Settings → Environment Variables
3. Añade las 3 variables:
   - `QSTASH_TOKEN`
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`
4. Marca las 3 para **Production**, **Preview**, y **Development**
5. **NO añadas** `NEXT_PUBLIC_APP_URL` (Vercel lo configura automáticamente con `VERCEL_URL`)

---

## Paso 5: Migración de base de datos

Ejecuta la migración para añadir la columna `qstash_schedule_id`:

```bash
# Local (si usas Supabase CLI)
supabase db push

# O ejecuta manualmente en Supabase Dashboard:
```

```sql
ALTER TABLE prebookings
ADD COLUMN IF NOT EXISTS qstash_schedule_id TEXT;

CREATE INDEX IF NOT EXISTS idx_prebookings_qstash_schedule_id
ON prebookings(qstash_schedule_id)
WHERE qstash_schedule_id IS NOT NULL;
```

---

## Paso 6: Deploy

```bash
# Commit cambios
git add .
git commit -m "feat: migrate to QStash for prebooking execution"

# Deploy a Vercel
git push origin main
```

Vercel detectará las nuevas variables de entorno y hará el deploy automáticamente.

---

## Paso 7: Verificar que funciona

### Test 1: Crear un prebooking

1. Ve a tu app
2. Intenta reservar una clase que aún no está disponible
3. Deberías ver un mensaje de "Pre-reserva creada"
4. En los logs de Vercel, deberías ver:
   ```
   [QStash] Scheduling prebooking: ...
   [QStash] Scheduled successfully: messageId=...
   ```

### Test 2: Ver en QStash Dashboard

1. Ve a https://console.upstash.com/qstash
2. Click en **"Messages"**
3. Deberías ver tu mensaje programado con:
   - **URL**: `https://tu-app.vercel.app/api/execute-prebooking`
   - **Scheduled for**: El timestamp exacto (`available_at`)
   - **Status**: `SCHEDULED`

### Test 3: Esperar a la ejecución

1. Espera hasta el timestamp programado
2. QStash llamará tu endpoint automáticamente
3. En los logs de Vercel deberías ver:
   ```
   [QStash Webhook xxx] Processing prebooking ...
   [QStash Webhook xxx] ✅ Prebooking completed successfully
   ```

### Test 4: Cancelar prebooking

1. Cancela un prebooking desde la UI
2. En los logs deberías ver:
   ```
   [PreBooking API] Canceled QStash message ... for prebooking ...
   ```
3. En QStash Dashboard, el mensaje debería desaparecer o mostrar **Status: CANCELLED**

---

## Paso 8: Limpiar código viejo (OPCIONAL)

Una vez confirmes que QStash funciona correctamente, puedes eliminar el código del cron viejo:

```bash
# Eliminar archivos de cron
rm -rf app/api/cron/prebooking-scheduler
rm -rf modules/prebooking/business/prebooking-scheduler.business.ts

# Eliminar métodos no usados en prebooking.service.ts:
# - findReadyToExecute()
# - findPendingInTimeRange()
# - claimPrebooking()
```

Y desactivar el cron en cron-job.org.

---

## Troubleshooting

### Error: "QSTASH_TOKEN environment variable is required"

**Solución**: Verifica que las variables de entorno están configuradas en Vercel.

```bash
# Verificar en local
echo $QSTASH_TOKEN

# Verificar en Vercel
vercel env ls
```

### Error: "Invalid QStash signature"

**Posibles causas**:
1. `QSTASH_CURRENT_SIGNING_KEY` o `QSTASH_NEXT_SIGNING_KEY` incorrectos
2. Las llaves rotaron en QStash (actualiza en Vercel)

**Solución**: Copia las llaves nuevamente desde QStash Dashboard y actualiza en Vercel.

### Prebooking no se ejecuta

**Verificar**:
1. En QStash Dashboard → Messages: ¿El mensaje tiene status SCHEDULED?
2. ¿El timestamp es correcto? (UTC, no local time)
3. En logs de Vercel: ¿Hay errores en el webhook?

**Solución común**: Asegúrate que la URL del webhook es accesible:
```bash
curl -X POST https://tu-app.vercel.app/api/execute-prebooking \
  -H "Content-Type: application/json" \
  -d '{"prebookingId":"test"}'
```

Deberías recibir error 401 (Unauthorized) porque no tiene firma QStash, pero eso confirma que el endpoint existe.

### No puedo cancelar un prebooking

**Causa**: El `qstashScheduleId` no se guardó en la DB.

**Solución**: Verifica que el método `updateQStashScheduleId()` se ejecuta correctamente:
```typescript
// En app/api/booking/route.ts debería haber:
await preBookingService.updateQStashScheduleId(
  prebooking.id,
  qstashScheduleId
);
```

---

## Comparación: Antes vs Después

| Métrica | Cron-job.org (Antes) | QStash (Después) |
|---------|---------------------|------------------|
| **Jitter** | 1-10 segundos | <100ms |
| **Precisión** | Polling cada 60s | Timestamp exacto |
| **Costo** | Gratis | $1.80/mes |
| **Complejidad código** | 450 líneas | 170 líneas |
| **Arquitectura** | Polling + batch | Event-driven + individual |
| **Mantenimiento** | Alto (timeout guards, FIFO logic) | Bajo (QStash maneja todo) |

---

## Monitoreo

### QStash Dashboard
- **Messages**: Ve todos los mensajes programados y ejecutados
- **Logs**: Ve el historial de requests
- **Metrics**: Ve estadísticas de uso y errores

### Vercel Logs
```bash
# Ver logs en tiempo real
vercel logs --follow

# Filtrar solo prebooking execution
vercel logs --follow | grep "QStash Webhook"
```

---

## Soporte

- **QStash Docs**: https://upstash.com/docs/qstash
- **QStash Discord**: https://discord.gg/upstash
- **Vercel Support**: https://vercel.com/support

---

## Resumen de comandos

```bash
# 1. Instalar dependencia (ya hecho)
pnpm add @upstash/qstash

# 2. Migración DB
# Ejecutar SQL en Supabase Dashboard

# 3. Deploy
git add .
git commit -m "feat: migrate to QStash"
git push origin main

# 4. Monitorear
vercel logs --follow | grep "QStash"
```

¡Listo! 🎉
