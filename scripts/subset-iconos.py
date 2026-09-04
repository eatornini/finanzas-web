#!/usr/bin/env python3
"""Genera la fuente de iconos subseteada y el mapa nombre -> caracter.

Material Symbols es una fuente variable enorme (~15 MB) cuyos iconos se
referencian por ligadura (rlig). Subsetear por texto no achica nada porque
todos los nombres de icono usan el mismo alfabeto. En cambio subseteamos por
los codepoints (PUA) de los iconos que queremos, sin capas de layout, y en el
front referenciamos cada icono por su caracter.

Salidas:
  - assets/fonts/material-symbols.woff2
  - src/ui/iconos-codepoints.js   (export ICONOS = { nombre: "", ... })

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


def codepoints_por_nombre(font, nombres):
    cmap = font.getBestCmap()
    glyph_a_cp = {}
    for cp, g in cmap.items():
        glyph_a_cp.setdefault(g, cp)
    gsub = font["GSUB"].table

    def ligadura(nombre):
        seq = [cmap[ord(c)] for c in nombre]
        for lookup in gsub.LookupList.Lookup:
            for st in lookup.SubTable:
                sub = getattr(st, "ExtSubTable", None) or st
                if sub.__class__.__name__ != "LigatureSubst":
                    continue
                if seq[0] not in sub.ligatures:
                    continue
                for lig in sub.ligatures[seq[0]]:
                    if list(lig.Component) == seq[1:]:
                        return lig.LigGlyph
        return None

    salida, faltan = {}, []
    for n in nombres:
        g = ligadura(n)
        if g is None or g not in glyph_a_cp:
            faltan.append(n)
        else:
            salida[n] = glyph_a_cp[g]
    return salida, faltan


def main():
    from fontTools.ttLib import TTFont

    nombres = [l.strip() for l in LISTA.read_text().splitlines() if l.strip()]
    font = TTFont(str(FUENTE))
    mapa, faltan = codepoints_por_nombre(font, nombres)
    if faltan:
        print("ADVERTENCIA: iconos sin codepoint (se omiten):", faltan)

    WOFF2.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        estatica = Path(tmp) / "ms-static.ttf"
        subprocess.run(
            [sys.executable, "-m", "fontTools.varLib.instancer", str(FUENTE),
             "wght=400", "FILL=0", "GRAD=0", "opsz=24", "-o", str(estatica)],
            check=True,
        )
        unicodes = ",".join(f"U+{cp:04X}" for cp in mapa.values())
        subprocess.run(
            [sys.executable, "-m", "fontTools.subset", str(estatica),
             f"--output-file={WOFF2}", "--flavor=woff2",
             f"--unicodes={unicodes}",
             "--layout-features=", "--no-hinting", "--desubroutinize",
             "--name-IDs=", "--notdef-outline"],
            check=True,
        )

    entradas = ",\n".join(
        f'  {json.dumps(n)}: "\\u{cp:04x}"' for n, cp in mapa.items()
    )
    MAPA_JS.write_text(
        "// Generado por scripts/subset-iconos.py - no editar a mano.\n"
        "// nombre de icono Material Symbols -> caracter en material-symbols.woff2\n"
        f"export const ICONOS = {{\n{entradas},\n}};\n",
        encoding="utf-8",
    )
    print(f"OK  {WOFF2.relative_to(RAIZ)}  ({WOFF2.stat().st_size // 1024} KB, {len(mapa)} iconos)")
    print(f"OK  {MAPA_JS.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
