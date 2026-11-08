#!/usr/bin/env python3
"""Create a new explorer book from the bundled template.

    python3 init_book.py <dest-dir> --title "Book Title" [--sub "Source · Term"]

Copies assets/template/ to <dest-dir> (which must not exist or be empty), sets
the title, and prints the layout. Edit book.json (parts, chapter ids, colour
roles), chapters/00-front.html and map/data.json afterwards.
"""
import argparse
import json
import shlex
import shutil
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "assets" / "template"
SKILLS = Path(__file__).resolve().parent.parent.parent  # holds this skill and its siblings


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dest", type=Path)
    ap.add_argument("--title", required=True)
    ap.add_argument("--sub", default="")
    args = ap.parse_args()

    dest = args.dest.resolve()
    if dest.exists() and any(dest.iterdir()):
        sys.exit(f"{dest} exists and is not empty; pick a new folder")
    shutil.copytree(TEMPLATE, dest, dirs_exist_ok=True)
    for d in ("figs", "scripts", "chapters", "map"):
        (dest / d).mkdir(exist_ok=True)

    cfg_path = dest / "book.json"
    cfg = json.loads(cfg_path.read_text())
    cfg["title"] = args.title
    if args.sub:
        cfg["sub"] = args.sub
    cfg_path.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n")
    front = dest / "chapters" / "00-front.html"
    front.write_text(front.read_text().replace("BOOK TITLE", args.title))

    # tools/fig.sh needs the sibling skills; record where they are for this install
    render = SKILLS / "tikz-dl-visualizer" / "scripts" / "render.py"
    live = SKILLS / "tikz-live"
    (dest / "tools" / "skills.env").write_text(
        "# Written by init_book.py: where tools/fig.sh finds the sibling skills.\n"
        "# DLVIZ_RENDER / TIKZ_LIVE in the environment take precedence.\n"
        f"BOOK_DLVIZ_RENDER={shlex.quote(str(render))}\n"
        f"BOOK_TIKZ_LIVE={shlex.quote(str(live))}\n")
    for need in (render, live / "scripts" / "build.py"):
        if not need.is_file():
            print(f"warning: {need} not found; set DLVIZ_RENDER / TIKZ_LIVE for tools/fig.sh", file=sys.stderr)

    print(f"created {dest}")
    print("  book.json              title, parts, chapter ids, colour roles, map settings")
    print("  chapters/00-front.html hero, how to read, conventions, legend (<!--ROLES-->), map slot (<!--MAP-->)")
    print("  chapters/<cid>.html    one <section class=\"chapter\"> per chapter (written by authors)")
    print("  figs/<cid>-<slug>.tex  TikZ sources; render with: bash tools/fig.sh figs/<file>.tex")
    print("  scripts/<cid>-<slug>.py  the Python that computes every figure number")
    print("  map/data.json          concept-map families, nodes, links, tour")
    print("  build:  python3 tools/build.py   ->  index.html (publish) + preview.html (local)")


if __name__ == "__main__":
    main()
