#!/usr/bin/env python3
"""Genera las fuentes de iconos (subset curado + subset completo) y sus
mapas nombre -> caracter.

Material Symbols es una fuente variable enorme (~15 MB) cuyos iconos se
referencian por ligadura (rlig) y además tienen un codepoint PUA propio.
Reconstruimos nombre -> codepoint enumerando directamente las reglas de
ligadura del GSUB (cada regla mapea la secuencia de glifos del nombre a un
glifo final que ya tiene codepoint en el cmap) — no depende de ninguna
lista externa de Google, así que cubre los ~4200 iconos de la fuente sin
mantenimiento manual.

Con esos nombres generamos dos subsets:
  - uno curado y chico (scripts/iconos-lista.txt), para el picker rápido
    que se carga siempre;
  - uno completo (todos los iconos de la fuente), para el buscador que se
    carga bajo demanda en el navegador (ver src/ui/iconoCategoria.js).

Salidas:
  - assets/fonts/material-symbols.woff2        (subset curado)
  - src/ui/iconos-codepoints.js                 (mapa del subset curado)
  - assets/fonts/material-symbols-full.woff2   (subset completo)
  - src/ui/iconos-codepoints-full.js            (mapa completo)

Requiere: pip install fonttools brotli
Uso: python scripts/subset-iconos.py
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "Finanzas APK/app/src/main/res/font/material_symbols.ttf"
LISTA = RAIZ / "scripts/iconos-lista.txt"
WOFF2 = RAIZ / "assets/fonts/material-symbols.woff2"
MAPA_JS = RAIZ / "src/ui/iconos-codepoints.js"
WOFF2_FULL = RAIZ / "assets/fonts/material-symbols-full.woff2"
MAPA_JS_FULL = RAIZ / "src/ui/iconos-codepoints-full.js"

ALFABETO_NOMBRE = "abcdefghijklmnopqrstuvwxyz0123456789_"


def todos_los_nombres(font):
    """nombre de icono -> codepoint PUA, para cada regla de ligadura GSUB."""
    cmap = font.getBestCmap()
    glyph_a_cp = {}
    for cp, g in cmap.items():
        glyph_a_cp.setdefault(g, cp)
    glyph_a_char = {cmap[ord(c)]: c for c in ALFABETO_NOMBRE if ord(c) in cmap}

    nombres = {}
    gsub = font["GSUB"].table
    for lookup in gsub.LookupList.Lookup:
        for st in lookup.SubTable:
            sub = getattr(st, "ExtSubTable", None) or st
            if sub.__class__.__name__ != "LigatureSubst":
                continue
            for first_glyph, ligaduras in sub.ligatures.items():
                primero = glyph_a_char.get(first_glyph)
                if primero is None:
                    continue
                for lig in ligaduras:
                    chars = [primero]
                    ok = True
                    for comp in lig.Component:
                        c = glyph_a_char.get(comp)
                        if c is None:
                            ok = False
                            break
                        chars.append(c)
                    if not ok:
                        continue
                    cp = glyph_a_cp.get(lig.LigGlyph)
                    if cp is not None:
                        nombres["".join(chars)] = cp
    return nombres


def instanciar_estatica(tmp_dir):
    estatica = Path(tmp_dir) / "ms-static.ttf"
    subprocess.run(
        [sys.executable, "-m", "fontTools.varLib.instancer", str(FUENTE),
         "wght=400", "FILL=0", "GRAD=0", "opsz=24", "-o", str(estatica)],
        check=True,
    )
    return estatica


def generar_woff2(estatica, mapa, destino):
    destino.parent.mkdir(parents=True, exist_ok=True)
    unicodes = ",".join(f"U+{cp:04X}" for cp in mapa.values())
    subprocess.run(
        [sys.executable, "-m", "fontTools.subset", str(estatica),
         f"--output-file={destino}", "--flavor=woff2",
         f"--unicodes={unicodes}",
         "--layout-features=", "--no-hinting", "--desubroutinize",
         "--name-IDs=", "--notdef-outline"],
        check=True,
    )


def escribir_mapa_js(mapa, destino, nombre_export):
    entradas = ",\n".join(
        f'  {json.dumps(n)}: "\\u{cp:04x}"' for n, cp in sorted(mapa.items())
    )
    destino.write_text(
        "// Generado por scripts/subset-iconos.py - no editar a mano.\n"
        "// nombre de icono Material Symbols -> caracter en la fuente correspondiente\n"
        f"export const {nombre_export} = {{\n{entradas},\n}};\n",
        encoding="utf-8",
    )


def main():
    from fontTools.ttLib import TTFont

    font = TTFont(str(FUENTE))
    completo = todos_los_nombres(font)

    nombres_curados = [l.strip() for l in LISTA.read_text().splitlines() if l.strip()]
    curado = {}
    faltan = []
    for n in nombres_curados:
        if n in completo:
            curado[n] = completo[n]
        else:
            faltan.append(n)
    if faltan:
        print("ADVERTENCIA: iconos curados sin codepoint (se omiten):", faltan)

    with tempfile.TemporaryDirectory() as tmp:
        estatica = instanciar_estatica(tmp)
        generar_woff2(estatica, curado, WOFF2)
        generar_woff2(estatica, completo, WOFF2_FULL)

    escribir_mapa_js(curado, MAPA_JS, "ICONOS")
    escribir_mapa_js(completo, MAPA_JS_FULL, "ICONOS_COMPLETOS")

    print(f"OK  {WOFF2.relative_to(RAIZ)}  ({WOFF2.stat().st_size // 1024} KB, {len(curado)} iconos)")
    print(f"OK  {MAPA_JS.relative_to(RAIZ)}")
    print(f"OK  {WOFF2_FULL.relative_to(RAIZ)}  ({WOFF2_FULL.stat().st_size // 1024} KB, {len(completo)} iconos)")
    print(f"OK  {MAPA_JS_FULL.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
