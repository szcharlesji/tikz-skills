#!/bin/bash
# Render one figure in both themes.
#   bash tools/fig.sh figs/<id>.tex            static figure (tikz-dl-visualizer)
#   bash tools/fig.sh figs/<id>.tex [--no-tex] live figure: the .tex loads dllive and figs/<id>.js exists (tikz-live)
# Writes figs/<id>.png (dark: the one you review) and figs/<id>-light.png.
# The .tex must contain exactly \usepackage[dark]{dlviz}; the light copy is generated from it.
# Uses the tikz-dl-visualizer skill's renderer (it copies dlviz.sty next to the figure).
# Finds the sibling skills through DLVIZ_RENDER / TIKZ_LIVE if set, else tools/skills.env
# (written by init_book.py with the paths it found), else ~/.claude/skills.
set -euo pipefail
TOOLS=$(cd "$(dirname "$0")" && pwd)
if [ -f "$TOOLS/skills.env" ]; then . "$TOOLS/skills.env"; fi
RENDER=""
for cand in "${DLVIZ_RENDER:-}" "${BOOK_DLVIZ_RENDER:-}" "$HOME/.claude/skills/tikz-dl-visualizer/scripts/render.py"; do
  if [ -n "$cand" ] && [ -f "$cand" ]; then RENDER="$cand"; break; fi
done
if [ -z "$RENDER" ]; then
  echo "tikz-dl-visualizer's render.py not found; install that skill or set DLVIZ_RENDER=/path/to/render.py" >&2
  exit 2
fi
tex=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
dir=$(dirname "$tex"); id=$(basename "$tex" .tex)

# A live figure (\usepackage{dllive} + a <id>.js spec next to it) is built by the
# tikz-live skill in both themes. It writes <id>.png, <id>-light.png, one PNG per
# snapshot (<id>.<snap>.png), <id>.html (standalone, for trying it) and
# <id>.live.html, the fragment tools/build.py inlines into the book.
if grep -q '\\usepackage{dllive}' "$tex"; then
  LIVE=""
  for cand in "${TIKZ_LIVE:-}" "${BOOK_TIKZ_LIVE:-}" "$HOME/.claude/skills/tikz-live"; do
    if [ -n "$cand" ] && [ -f "$cand/scripts/build.py" ]; then LIVE="$cand"; break; fi
  done
  [ -n "$LIVE" ] || { echo "live figure needs the tikz-live skill (or TIKZ_LIVE=/path/to/tikz-live)" >&2; exit 2; }
  [ -f "$dir/$id.js" ] || { echo "live figure needs its spec: $dir/$id.js" >&2; exit 2; }
  grep -q '\\usepackage\[dark\]{dlviz}' "$tex" || { echo "$tex: needs \\usepackage[dark]{dlviz}" >&2; exit 2; }
  shift
  uv run -q --with pymupdf python "$LIVE/scripts/build.py" "$tex" --themes dark,light --embed "$@"
  # the book inlines this runtime once; keep a copy so the book rebuilds without the skill
  cp "$LIVE/assets/dllive.js" "$TOOLS/dllive.js"
  exit 0
fi

grep -q '\\usepackage\[dark\]{dlviz}' "$tex" || { echo "$tex: needs \\usepackage[dark]{dlviz}" >&2; exit 2; }
python3 "$RENDER" "$tex" --dpi 200
mkdir -p "$dir/.light"
sed 's/\\usepackage\[dark\]{dlviz}/\\usepackage[light]{dlviz}/' "$tex" > "$dir/.light/$id-light.tex"
python3 "$RENDER" "$dir/.light/$id-light.tex" --dpi 200 >/dev/null
mv "$dir/.light/$id-light.png" "$dir/$id-light.png"
rm -rf "$dir/.light"   # the light .tex is regenerated on every render; nothing there is worth keeping
echo "light png: $dir/$id-light.png"
