# Rollback: Race Condition Prevention Feature

Si necesitas revertir la implementación de la prevención de race conditions, sigue esta guía paso a paso.

## ⚠️ Por qué Hacer Rollback?

- El feature causa problemas inesperados
- El feature impacta performance
- Necesitas revertir a la versión anterior

## 🔄 Proceso de Rollback

### Opción 1: Rollback Automático (Recomendado)

```bash
# Hacer el rollback del código
bash scripts/rollback-race-condition-fix.sh

# Hacer el rollback de la base de datos
# (Ejecutar en Supabase SQL Editor)
supabase/migrations/010_rollback_session_locks.sql
```

### Opción 2: Rollback Manual

#### Paso 1: Revertir cambios en el código

**1.1 Revertir `modules/auth/api/services/supabase-session.service.ts`**

Eliminar los siguientes métodos del final de la clase `SupabaseSessionService`:

```typescript
// REMOVER estas líneas (1423-1544):
static async acquireSessionLock(...)
static async releaseSessionLock(...)
static async hasActiveLock(...)
static async cleanupExpiredLocks(...)
```

**1.2 Revertir `app/api/execute-prebooking/route.ts`**

Buscar y remover:

```typescript
// Línea ~167-180: REMOVER bloque de lock
let lockSessionFingerprint: string | undefined;
if (session) {
  lockSessionFingerprint = session.fingerprint;
  lockAcquired = await SupabaseSessionService.acquireSessionLock(...)
  // ...
}

// Línea ~222-227: REMOVER release después de session not found
if (lockAcquired && lockSessionFingerprint) {
  await SupabaseSessionService.releaseSessionLock(...)
}

// Línea ~367-373: REMOVER release después de token refresh fail
if (lockAcquired && lockSessionFingerprint) {
  await SupabaseSessionService.releaseSessionLock(...)
}

// Línea ~747-753: REMOVER release después de éxito
if (lockAcquired && lockSessionFingerprint) {
  await SupabaseSessionService.releaseSessionLock(...)
}
```

**1.3 Revertir `app/api/cron/refresh-tokens/route.ts`**

Remover el bloque de verificación de lock (línea ~105-118):

```typescript
// REMOVER:
const hasLock = await SupabaseSessionService.hasActiveLock(...)
if (hasLock) {
  console.log(...)
  results.skipped++;
  continue;
}
```

#### Paso 2: Revertir cambios en la base de datos

En la consola SQL de Supabase, ejecutar:

```sql
-- DROP functions
DROP FUNCTION IF EXISTS cleanup_expired_locks() CASCADE;
DROP FUNCTION IF EXISTS has_active_lock(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS release_session_lock(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS acquire_session_lock(TEXT, TEXT, TEXT, INT) CASCADE;

-- DROP indexes
DROP INDEX IF EXISTS idx_session_locks_expires_at CASCADE;
DROP INDEX IF EXISTS idx_session_locks_user_email_fingerprint CASCADE;

-- DROP table
DROP TABLE IF EXISTS session_locks CASCADE;
```

#### Paso 3: Limpiar archivos de migración

```bash
# Eliminar los archivos de migración creados
rm supabase/migrations/009_add_session_locks_table.sql
rm supabase/migrations/010_rollback_session_locks.sql

# Eliminar este documento
rm .claude/doc/ROLLBACK_RACE_CONDITION_FIX.md
```

#### Paso 4: Commit de cambios

```bash
# Verificar qué ha cambiado
git status

# Agregar cambios
git add .

# Commit
git commit -m "revert: disable race condition prevention feature

- Remove session_locks table and related functions
- Revert lock acquisition/release logic from execute-prebooking
- Revert lock checking logic from cron job
- Clean up migration files

Reason: [Tu razón aquí]"

# Push
git push origin main
```

## ✅ Verificación Post-Rollback

### 1. Verificar código

```bash
# No debe haber referencias a 'acquireSessionLock' o 'releaseSessionLock'
grep -r "acquireSessionLock\|releaseSessionLock\|hasActiveLock" app/
grep -r "acquireSessionLock\|releaseSessionLock\|hasActiveLock" modules/

# Ambos comandos NO deben retornar resultados
```

### 2. Verificar base de datos

En Supabase SQL Editor:

```sql
-- No debe existir la tabla
SELECT * FROM session_locks;
-- Debe retornar: ERROR: relation "session_locks" does not exist

-- Las funciones no deben existir
SELECT 1 FROM pg_proc WHERE proname = 'acquire_session_lock';
-- Debe retornar: (no rows)
```

### 3. Verificar aplicación

```bash
# Ejecutar tests
npm run test

# Compilar
npm run build

# Ver que no hay errores de tipos
npx tsc --noEmit
```

## 🆘 Si Algo Sale Mal

Si durante el rollback algo se rompe:

### Git Restore

```bash
# Restaurar todos los cambios de un commit anterior
git reset --hard HEAD~1

# O restaurar un archivo específico
git checkout HEAD~1 -- app/api/execute-prebooking/route.ts
```

### Supabase Restore

Si la base de datos queda en estado inconsistente:

1. Ve a Supabase Dashboard
2. Abre SQL Editor
3. Ejecuta el rollback manual manualmente
4. Verifica que no hay tablas o funciones de locks

## 📞 Soporte

Si necesitas ayuda con el rollback:

1. Revisa los logs de git: `git log --oneline -10`
2. Verifica el estado de la DB: `supabase status`
3. Consulta el historial de migraciones: `supabase migration list`

---

**Última actualización**: 2025-11-21
