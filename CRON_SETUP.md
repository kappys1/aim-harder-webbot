# Configuración del Cron Job para Refresh de Sesiones

## GitHub Actions Setup (RECOMENDADO - Gratis)

### 1. Variables de Entorno

**En tu hosting (Vercel/etc):**

```bash
INTERNAL_API_KEY=G2cxITbUjQqJZ/EXCjJJwkSNq81TIly2HNDnex/nnMk=
```

**En GitHub Secrets:**

1. Ve a tu repositorio → Settings → Secrets and variables → Actions
2. Añade estos secrets:
   - `INTERNAL_API_KEY`: `G2cxITbUjQqJZ/EXCjJJwkSNq81TIly2HNDnex/nnMk=`
   - `APP_URL`: `https://tu-app.vercel.app` (sin barra final)

### 2. Archivo de Workflow

El archivo `.github/workflows/refresh-sessions.yml` ya está configurado y:

- Se ejecuta cada 6 horas (00:00, 06:00, 12:00, 18:00 UTC)
- Procesa 20 sesiones por lote
- Refresh threshold de 6 horas
- Puedes ejecutarlo manualmente desde GitHub Actions

### 3. Activación

1. Haz push del archivo workflow a tu repositorio
2. Ve a la pestaña "Actions" en GitHub
3. Verifica que aparezca "Refresh Aimharder Sessions"
4. Ejecuta manualmente una vez para probar

## Monitoreo

### Logs de Ejecución

- **GitHub Actions**: Pestaña Actions → Workflow runs
- **API Endpoint**: Logs de tu hosting provider

### Respuesta del Endpoint

```json
{
  "success": true,
  "processed": 15,
  "total": 23,
  "successful": 14,
  "failed": 1,
  "results": [
    {
      "email": "user@example.com",
      "success": true
    }
  ]
}
```
