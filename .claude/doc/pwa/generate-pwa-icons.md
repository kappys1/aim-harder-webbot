# Generar Iconos PWA

Para generar los iconos PWA necesarios desde tu logo, puedes hacerlo de dos maneras:

## Opción 1: Usar una herramienta online (Recomendado)

1. Ve a [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)
2. Sube tu logo (el archivo con el logo azul y negro)
3. Descarga los iconos generados
4. Coloca `icon-192x192.png` y `icon-512x512.png` en la carpeta `/public`

## Opción 2: Usar ImageMagick (si lo tienes instalado)

```bash
# Instalar ImageMagick si no lo tienes
brew install imagemagick

# Generar iconos desde tu logo
convert logo.png -resize 192x192 public/icon-192x192.png
convert logo.png -resize 512x512 public/icon-512x512.png
```

## Opción 3: Usar un servicio online

Sitios web como:

- https://realfavicongenerator.net/
- https://favicon.io/
- https://www.favicon-generator.org/

## Iconos necesarios

- `icon-192x192.png` - Para pantallas normales
- `icon-512x512.png` - Para pantallas de alta resolución

Una vez que tengas los iconos, cópialos a la carpeta `public/` de tu proyecto.
