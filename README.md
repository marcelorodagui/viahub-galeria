# Galería Vía Hub Studio

Portafolio de reels y afiches. Sitio estático publicado en GitHub Pages:
https://marcelorodagui.github.io/viahub-galeria/

Las piezas se toman de `G:\Mi unidad\Vía Hub Studio\Galería web` (`Reels\<Marca>\`, `Afiches\<Marca>\`).

```bash
node herramientas/construir.mjs --publicar
```

El script comprime videos e imágenes con ffmpeg en `media/`, escribe `data/galeria.js` y sube los cambios.
