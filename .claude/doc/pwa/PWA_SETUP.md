# PWA Configuration - AIM-WOD-BOT

Esta aplicación ha sido configurada como Progressive Web App (PWA) ✅

## ¿Qué es una PWA?

Una PWA permite que la aplicación web:

- 📱 Se instale en dispositivos móviles y escritorio
- 🚀 Funcione offline con datos cacheados
- ⚡ Cargue más rápido gracias al Service Worker
- 🔔 Reciba notificaciones push (si se configura)
- 📲 Tenga una experiencia similar a una app nativa

## Archivos de Configuración

### 1. `public/manifest.json`

Contiene los metadatos de la aplicación:

- Nombre y descripción
- Iconos para diferentes dispositivos
- Colores del tema
- Orientación de pantalla

### 2. `next.config.ts`

Configurado con `next-pwa` para generar automáticamente el Service Worker.

### 3. `app/layout.tsx`

Incluye los meta tags necesarios:

- Link al manifest
- Configuración de viewport
- Iconos para Apple devices
- Meta tags para dispositivos móviles

### 4. Iconos

- `public/icon-192x192.png` - Para pantallas normales
- `public/icon-512x512.png` - Para pantallas de alta resolución
- Múltiples tamaños adicionales en `/public/android/` y `/public/ios/`

## Archivos Generados

Durante el build, `next-pwa` genera automáticamente:

- `public/sw.js` - Service Worker principal
- `public/workbox-*.js` - Librería Workbox para caché
- Estos archivos están en `.gitignore` y se regeneran en cada build

## Cómo Probar la PWA

### En Desarrollo

```bash
pnpm dev
```

**Nota:** El Service Worker está deshabilitado en modo desarrollo para facilitar el debugging.

### En Producción

```bash
# Compilar
pnpm build

# Ejecutar
pnpm start
```

### Instalar la PWA

#### En Chrome/Edge Desktop:

1. Visita la aplicación
2. Busca el icono de instalación en la barra de direcciones
3. Click en "Instalar"

#### En Chrome/Safari Mobile:

1. Abre la aplicación en el navegador
2. Toca el menú (⋮ o compartir)
3. Selecciona "Agregar a pantalla de inicio"

## Verificar la PWA

### Lighthouse Audit

1. Abre DevTools en Chrome (F12)
2. Ve a la pestaña "Lighthouse"
3. Selecciona "Progressive Web App"
4. Click en "Analyze page load"

### Application Panel

1. Abre DevTools (F12)
2. Ve a "Application" tab
3. Verifica:
   - ✅ Manifest
   - ✅ Service Workers
   - ✅ Cache Storage

## Características Configuradas

- ✅ Manifest con iconos y metadatos
- ✅ Service Worker para funcionamiento offline
- ✅ Caché automático de recursos estáticos
- ✅ Instalable en dispositivos
- ✅ Splash screen (generado del manifest)
- ✅ Compatible con iOS y Android
- ✅ Compatible con Windows 11

## Próximos Pasos (Opcional)

### Push Notifications

Para agregar notificaciones push, necesitas:

1. Configurar Firebase Cloud Messaging o similar
2. Solicitar permisos de notificación
3. Manejar eventos en el Service Worker

### Offline Functionality

El Service Worker actual cachea recursos estáticos. Para mejorar:

1. Configurar estrategias de caché personalizadas
2. Agregar caché de API responses
3. Implementar sincronización en background

### Analytics

Para trackear instalaciones:

1. Escuchar el evento `beforeinstallprompt`
2. Enviar eventos a tu herramienta de analytics

## Recursos

- [Next-PWA Documentation](https://github.com/shadowwalker/next-pwa)
- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [PWA Builder](https://www.pwabuilder.com/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)

## Troubleshooting

### La PWA no se instala

- Verifica que estés usando HTTPS (o localhost)
- Comprueba que el manifest.json sea válido
- Revisa que el Service Worker se registre correctamente

### El Service Worker no se actualiza

- Haz un "hard refresh" (Ctrl+Shift+R)
- Borra el caché en DevTools > Application > Clear storage
- Reinicia el navegador

### Cambios no se reflejan

- El Service Worker cachea recursos
- En producción, usa "skipWaiting: true" (ya configurado)
- Para testing, desactiva el Service Worker en DevTools
