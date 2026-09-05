# Regenerar las fuentes de iconos

`scripts/subset-iconos.py` genera **dos** subsets a partir de la fuente
variable Material Symbols que trae la app Android
(`Finanzas APK/app/src/main/res/font/material_symbols.ttf`, ~15 MB,
gitignored):

- **Curado** (`assets/fonts/material-symbols.woff2`, ~8 KB): los iconos de
  `scripts/iconos-lista.txt`. Se carga siempre — es el picker rápido del
  formulario de categoría.
- **Completo** (`assets/fonts/material-symbols-full.woff2`, ~300 KB): los
  ~4200 iconos de la fuente. Se carga bajo demanda desde el navegador (ver
  `cargarIconosCompletos()` en `src/ui/iconoCategoria.js`) recién cuando el
  usuario abre el buscador de iconos — nunca en la carga inicial de la app.
  Queda cacheado por el service worker una vez descargado.

Esa fuente es variable y referencia sus iconos por ligadura (`rlig`) *y*
por un codepoint PUA propio de cada glifo. En vez de depender de una lista
de nombres externa (la de Google cambia de versión en versión), el script
reconstruye **nombre -> codepoint para los ~4200 iconos** enumerando
directamente las reglas de ligadura del `GSUB`: cada regla mapea la
secuencia de glifos que forman el nombre a un glifo final, y ese glifo ya
tiene su codepoint en el `cmap`. De ahí sale tanto el subset completo como
el filtrado del curado.

## Uso

    pip install fonttools brotli
    python scripts/subset-iconos.py

Genera:

- `assets/fonts/material-symbols.woff2` + `src/ui/iconos-codepoints.js`
  (`export const ICONOS = { nombre: "<caracter>", ... }`, subset curado)
- `assets/fonts/material-symbols-full.woff2` + `src/ui/iconos-codepoints-full.js`
  (`export const ICONOS_COMPLETOS = { ... }`, subset completo)

## Agregar un icono al picker rápido (curado)

El icono ya está disponible para cualquier usuario a través del buscador
(subset completo) sin tocar nada. Para que además aparezca en la grilla
rápida del formulario:

1. Sumar el nombre de ligadura a `scripts/iconos-lista.txt`.
2. Sumarlo a `LISTA_ICONOS` en `src/ui/iconoCategoria.js` (para que aparezca en el picker).
3. Volver a correr `python scripts/subset-iconos.py`.
4. Commitear el `.woff2` y el `iconos-codepoints.js` regenerados.

Los nombres válidos son los de https://fonts.google.com/icons (estilo
"Material Symbols").

## Cuándo regenerar el subset completo

Solo hace falta si se reemplaza el TTF vendoreado (por ejemplo al
actualizar a una versión más nueva de Material Symbols con iconos nuevos).
El subset completo actual ya cubre todos los iconos presentes hoy en esa
fuente, así que el buscador no necesita regeneración por cada icono nuevo
que un usuario quiera usar.
