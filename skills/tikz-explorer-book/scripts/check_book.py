#!/usr/bin/env python3
"""Static checks for an explorer book, plus a contact sheet of every figure.

    python3 check_book.py <book-dir> [--sheet] [--files-json]

Builds the book, then reports:
  - chapters listed in book.json that are missing, and chapter files not listed;
  - per chapter: words, figures, and fragment problems (not exactly one
    <section class="chapter">, stray $ math, <script>/<style> tags);
  - figure images that are missing, and missing -light.png twins;
  - live figures (tikz-live): a .js spec without its built .live.html, or a
    .live.html older than its .tex/.js (re-render with tools/fig.sh);
  - internal links (#id) that point nowhere;
  - concept-map problems: unknown ids in links/tour, "deeper" chapter ids that
    do not exist, nodes with no links, families with no concepts.
--sheet   writes .qa/contact-N.png (needs ImageMagick), so you can eyeball every figure at once
--files-json  prints the list of figure files in the shape the Artifact publish `files` takes
Exit code 1 if anything blocking was found.
"""
import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("book", type=Path)
    ap.add_argument("--sheet", action="store_true")
    ap.add_argument("--files-json", action="store_true")
    args = ap.parse_args()
    book = args.book.resolve()
    problems, notes = [], []

    r = subprocess.run([sys.executable, str(book / "tools" / "build.py")], capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
    if r.returncode:
        sys.exit(1)

    cfg = json.loads((book / "book.json").read_text())
    listed = [c for p in cfg["parts"] for c in p["chapters"]]
    files = {f.stem for f in (book / "chapters").glob("*.html") if f.stem != "00-front"}
    for c in listed:
        if c not in files:
            notes.append(f"chapter not written yet: {c}")
    for c in sorted(files - set(listed)):
        problems.append(f"chapters/{c}.html is not listed in book.json, so it is not in the book")

    nlive = [0]
    print("\nchapter    words  figs")
    for c in listed:
        f = book / "chapters" / f"{c}.html"
        if not f.exists():
            continue
        t = f.read_text()
        words = len(re.sub(r"<[^>]+>", " ", t).split())
        figs = t.count("<figure")
        print(f"{c:9} {words:6} {figs:5}")
        if t.count('<section class="chapter"') != 1:
            problems.append(f"{c}: needs exactly one <section class=\"chapter\" ...>")
        if re.search(r"(?<!\\)\$", re.sub(r"<pre.*?</pre>", "", t, flags=re.S)):
            problems.append(f"{c}: contains $ math; use \\( \\) and \\[ \\]")
        if re.search(r"<(script|style)\b", t):
            problems.append(f"{c}: fragments may not contain <script> or <style>")
        # a raw < inside maths starts an HTML tag and swallows the rest of the formula;
        # a raw > is legal HTML but the spec asks for \gt, so it is only a note
        for m in re.finditer(r"\\\((.*?)\\\)|\\\[(.*?)\\\]", t, flags=re.S):
            body = m.group(1) if m.group(1) is not None else m.group(2)
            if "<" in body:
                problems.append(f"{c}: raw '<' inside maths ({body.strip()[:40]}...); write \\lt or &lt;")
            elif ">" in body:
                notes.append(f"{c}: raw '>' inside maths ({body.strip()[:40]}...); prefer \\gt")
        if figs == 0:
            notes.append(f"{c}: no figures (this book is figure-first)")
        for src in re.findall(r'<img[^>]+src="([^"]+)"', t):
            live = book / src.replace(".png", ".live.html")
            spec = book / src.replace(".png", ".js")
            if spec.exists() and not live.exists():
                problems.append(f"{c}: {spec.name} exists but {live.name} does not; render it with tools/fig.sh")
            if live.exists():
                srcs = [p for p in (book / src.replace(".png", ".tex"), spec) if p.exists()]
                if any(p.stat().st_mtime > live.stat().st_mtime + 1 for p in srcs):
                    problems.append(f"{c}: {live.name} is older than its .tex/.js; re-render with tools/fig.sh")
                nlive[0] += 1
            if not (book / src).exists():
                problems.append(f"{c}: missing figure {src}")
            elif not (book / src.replace(".png", "-light.png")).exists():
                notes.append(f"{c}: no light twin for {src} (render with tools/fig.sh)")

    page = (book / "index.html").read_text()
    ids = set(re.findall(r'id="([^"]+)"', page))
    markup = re.sub(r"<script\b.*?</script>", "", page, flags=re.S)
    for target in sorted(set(re.findall(r'href="#([^"]+)"', markup))):
        if target in ids or target == "top":
            continue
        if target in listed:
            notes.append(f"link to #{target} waits for that chapter")
        else:
            problems.append(f"broken internal link #{target}")

    mp = book / "map" / "data.json"
    if mp.exists() and cfg.get("map", {}).get("enabled", True):
        d = json.loads(mp.read_text())
        nids = {n["id"] for n in d["nodes"]}
        fams = {f["id"] for f in d["families"]}
        for s, t, _ in d["links"]:
            for x in (s, t):
                if x not in nids:
                    problems.append(f"map: link uses unknown node {x}")
        for step in d.get("tour", []):
            for x in step["nodes"]:
                if x not in nids:
                    problems.append(f"map: tour step '{step['title']}' uses unknown node {x}")
        deg = Counter([s for s, _, _ in d["links"]] + [t for _, t, _ in d["links"]])
        for n in d["nodes"]:
            if deg[n["id"]] == 0:
                problems.append(f"map: node {n['id']} has no links")
            if n["type"] != "hub" and n.get("fam") not in fams:
                problems.append(f"map: node {n['id']} has unknown family {n.get('fam')}")
            for c in n.get("deeper", []):
                if c not in listed:
                    problems.append(f"map: node {n['id']} points to chapter {c}, which is not in book.json")
        for f in fams:
            if not any(n.get("fam") == f and n["type"] == "concept" for n in d["nodes"]):
                notes.append(f"map: family {f} has no concepts")
        # map.js pins the single hub at the centre; without one the map does not render
        hubs = [n["id"] for n in d["nodes"] if n["type"] == "hub"]
        if len(hubs) != 1:
            problems.append(f"map: needs exactly one node with type \"hub\" (found {len(hubs) or 'none'})")
        else:
            # every concept should reach the hub within a few hops over concept links
            kind = {n["id"]: n["type"] for n in d["nodes"]}
            adj = {}
            for s, t, _ in d["links"]:
                if kind.get(s) != "paper" and kind.get(t) != "paper":
                    adj.setdefault(s, set()).add(t)
                    adj.setdefault(t, set()).add(s)
            dist, frontier = {hubs[0]: 0}, [hubs[0]]
            while frontier:
                nxt = []
                for u in frontier:
                    for v in adj.get(u, ()):
                        if v not in dist:
                            dist[v] = dist[u] + 1
                            nxt.append(v)
                frontier = nxt
            for n in d["nodes"]:
                if n["type"] != "concept":
                    continue
                if n["id"] not in dist:
                    problems.append(f"map: concept {n['id']} cannot reach the hub through concept links")
                elif dist[n["id"]] > 3:
                    notes.append(f"map: concept {n['id']} is {dist[n['id']]} hops from the hub; add a link that places it")
        print(f"\nmap: {sum(n['type'] == 'concept' for n in d['nodes'])} concepts, "
              f"{sum(n['type'] == 'paper' for n in d['nodes'])} works, {len(d['links'])} links, "
              f"{len(d.get('tour', []))} tour steps")

    print(f"live figures: {nlive[0]}")
    # snapshot PNGs of live figures (<id>.<snap>.png) are for review only
    pngs = sorted(p for p in (book / "figs").glob("*.png") if "." not in p.stem)
    if args.sheet:
        dark = [p for p in pngs if not p.stem.endswith("-light")]
        out = book / ".qa"
        out.mkdir(exist_ok=True)
        for i in range(0, len(dark), 25):
            chunk = dark[i:i + 25]
            dest = out / f"contact-{i // 25 + 1}.png"
            subprocess.run(["magick", "montage", *map(str, chunk), "-tile", "5x", "-geometry",
                            "400x270+4+4", "-background", "#222", str(dest)], check=False)
            print(f"contact sheet: {dest}")
    if args.files_json:
        # live figures are inlined into the page, so their PNGs need not be published
        def is_live(p):
            return (p.parent / (p.stem.removesuffix("-light") + ".live.html")).exists()
        print(json.dumps([{"path": str(p.relative_to(book))} for p in pngs if not is_live(p)]))

    for n in notes:
        print("note:", n)
    for p in problems:
        print("PROBLEM:", p)
    print(f"\n{len(problems)} problem(s), {len(notes)} note(s)")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
