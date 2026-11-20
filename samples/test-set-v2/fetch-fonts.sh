#!/usr/bin/env bash
# Fetches the open fonts the v2 generator uses (SIL OFL, from npm @fontsource) into ./fonts:
# six Latin hand-writing fonts (Caveat, Reenie Beanie, Covered By Your Grace, Shadows Into Light Two,
# Gochi Hand, Nanum Pen Script), Kalam (Latin + Devanagari hand-writing), and Mukta / Noto Sans Devanagari
# for the printed parts of the forms. Latin and Devanagari subsets are merged into one TTF per weight.
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p fonts/src; cd fonts/src
for p in caveat reenie-beanie covered-by-your-grace shadows-into-light-two gochi-hand nanum-pen-script kalam mukta noto-sans-devanagari; do npm pack --silent "@fontsource/$p" >/dev/null; done
for f in *.tgz; do tar xzf "$f" --one-top-level="${f%.tgz}"; done
cd .. && python3 - <<'PY'
import glob, os
from fontTools.ttLib import TTFont
from fontTools.merge import Merger
for fam, w in [("caveat","400"),("caveat","700"),("reenie-beanie","400"),("covered-by-your-grace","400"),
               ("shadows-into-light-two","400"),("gochi-hand","400"),("nanum-pen-script","400"),
               ("kalam","400"),("kalam","700"),("mukta","400"),("mukta","700"),
               ("noto-sans-devanagari","400"),("noto-sans-devanagari","700")]:
    parts = [p for p in glob.glob(f"src/*{fam}*/package/files/{fam}-*-{w}-normal.woff")
             if os.path.basename(p) in (f"{fam}-latin-{w}-normal.woff", f"{fam}-devanagari-{w}-normal.woff")]
    tmp = []
    for i, p in enumerate(sorted(parts)):
        t = TTFont(p); t.flavor = None; o = f"/tmp/{fam}{w}-{i}.ttf"; t.save(o); tmp.append(o)
    (Merger().merge(tmp) if len(tmp) > 1 else TTFont(tmp[0])).save(f"{fam}-{w}.ttf")
print("fonts ready")
PY
