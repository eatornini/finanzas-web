# Regenerar la fuente de iconos

`assets/fonts/material-symbols.woff2` es un subset de la fuente Material Symbols
que trae la app Android (`Finanzas APK/app/src/main/res/font/material_symbols.ttf`,
~15 MB) reducido a los iconos de `scripts/iconos-lista.txt`.

Esa fuente es variable y referencia sus iconos por ligadura (`rlig`), y subsetear
por texto no achica nada porque todos los nombres usan el mismo alfabeto. Por eso
el subset se hace **por codepoint**: `scripts/subset-iconos.py` deriva el
codepoint PUA de cada icono desde las reglas de ligadura del TTF original,
instancia la fuente a un peso fijo y subsetea solo esos codepoints.

## Uso

    pip install fonttools brotli
    python scripts/subset-iconos.py

Genera:

- `assets/fonts/material-symbols.woff2` (~8 KB con la lista actual)
- `src/ui/iconos-codepoints.js` — `export const ICONOS = { nombre: "<caracter>", ... }`

## Agregar un icono

1. Sumar el nombre de ligadura a `scripts/iconos-lista.txt`.
2. Sumarlo a `LISTA_ICONOS` en `src/ui/iconoCategoria.js` (para que aparezca en el picker).
3. Volver a correr `python scripts/subset-iconos.py`.
4. Commitear el `.woff2` y el `iconos-codepoints.js` regenerados.

Los nombres válidos son los de https://fonts.google.com/icons (estilo "Material Symbols").
