#!/usr/bin/env bash
# Fonts for the v3 generator (SIL OFL, from npm @fontsource) into ./fonts.
# v3 re-uses the v2 fonts (printed parts, Kalam for Devanagari) and adds eight hands not used in v1 or v2:
# Homemade Apple, Zeyada, Mansalva, Nothing You Could Do, Just Another Hand, Sue Ellen Francisco, Rock Salt,
# and Amita (Devanagari). Run ../test-set-v2/fetch-fonts.sh first.
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p fonts/src; cd fonts/src
for p in homemade-apple zeyada mansalva nothing-you-could-do just-another-hand sue-ellen-francisco rock-salt amita; do npm pack --silent "@fontsource/$p" >/dev/null; done
for f in *.tgz; do tar xzf "$f" --one-top-level="${f%.tgz}"; done
cd .. && python3 - <<'PY'
import glob, os, shutil
from fontTools.ttLib import TTFont
from fontTools.merge import Merger
for f in glob.glob("../../test-set-v2/fonts/*.ttf"): shutil.copy(f, ".")
for fam in ["homemade-apple","zeyada","mansalva","nothing-you-could-do","just-another-hand","sue-ellen-francisco","rock-salt","amita"]:
    parts = [p for p in glob.glob(f"src/*{fam}*/package/files/{fam}-*-400-normal.woff")
             if os.path.basename(p) in (f"{fam}-latin-400-normal.woff", f"{fam}-devanagari-400-normal.woff")]
    tmp = []
    for i, p in enumerate(sorted(parts)):
        t = TTFont(p); t.flavor = None; o = f"/tmp/{fam}-{i}.ttf"; t.save(o); tmp.append(o)
    (Merger().merge(tmp) if len(tmp) > 1 else TTFont(tmp[0])).save(f"{fam}-400.ttf")
print("fonts ready:", len(glob.glob("*.ttf")))
PY
