#!/usr/bin/env bash
# Fetches the open fonts the generator uses (Kalam, Mukta, Noto Sans Devanagari; SIL OFL)
# from npm and merges their Latin + Devanagari subsets into single TTFs in ./fonts.
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p fonts/src; cd fonts/src
for p in @fontsource/kalam @fontsource/mukta @fontsource/noto-sans-devanagari; do npm pack --silent "$p" >/dev/null; done
for f in *.tgz; do tar xzf "$f" --one-top-level="${f%.tgz}"; done
cd .. && python3 - <<'PY'
import glob, os
from fontTools.ttLib import TTFont
from fontTools.merge import Merger
for fam, w in [("kalam","400"),("kalam","700"),("mukta","400"),("mukta","700"),("noto-sans-devanagari","400"),("noto-sans-devanagari","700")]:
    parts = [p for p in glob.glob(f"src/*{fam}*/package/files/{fam}-*-{w}-normal.woff") if "-latin-" in p or "-devanagari-" in p]
    parts = [p for p in parts if os.path.basename(p) in (f"{fam}-latin-{w}-normal.woff", f"{fam}-devanagari-{w}-normal.woff")]
    tmp = []
    for i, p in enumerate(sorted(parts)):
        t = TTFont(p); t.flavor = None; o = f"/tmp/{fam}{w}-{i}.ttf"; t.save(o); tmp.append(o)
    Merger().merge(tmp).save(f"{fam}-{w}.ttf")
print("fonts ready")
PY
