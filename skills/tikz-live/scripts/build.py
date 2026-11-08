#!/usr/bin/env python3
"""Build an interactive TikZ figure: TikZ scaffold + live JS overlay -> one HTML.

usage:
  uv run --with pymupdf python build.py figure.tex [figure.js] [--dpi 200] [--no-tex]

Writes next to figure.tex:
  figure.html          self-contained interactive page (open it, publish it, iframe it)
  figure.png           default state, rendered without a browser (LOOK AT THIS)
  figure.<snap>.png    one PNG per entry in spec.snapshots
  figure.svg           default state as a static SVG (for papers / fallbacks)
Intermediates go to .dllive/ next to the .tex.

Needs: pdflatex, node, PyMuPDF (uv --with pymupdf).
"""
import argparse, html, json, os, re, shutil, subprocess, sys
from pathlib import Path

try:
    import pymupdf
except ImportError:
    sys.exit("PyMuPDF missing: run with  uv run --with pymupdf python build.py ...")

SKILL = Path(__file__).resolve().parent.parent
ASSETS = SKILL / "assets"
PT_TO_BP = 72 / 72.27


def compile_tex(tex: Path, job: str, defs: str, work: Path, extra=()):
    dirs = [ASSETS, tex.parent, *extra]
    env = dict(os.environ, TEXINPUTS=os.pathsep.join(map(str, dirs)) + os.pathsep)
    cmd = ["pdflatex", "-interaction=nonstopmode", "-halt-on-error",
           f"-jobname={job}", f"-output-directory={work}", defs + rf"\input{{{tex.name}}}"]
    r = subprocess.run(cmd, cwd=tex.parent, env=env, capture_output=True, text=True)
    if r.returncode:
        log = (work / f"{job}.log").read_text(errors="replace") if (work / f"{job}.log").exists() else r.stdout
        i = log.find("\n!")
        msg = log[i:i + 900] if i >= 0 else log[-900:]
        if "File `" in msg and "not found" in msg:
            msg += "\n(missing package: install it with tlmgr; ask the user before installing)"
        sys.exit(f"pdflatex failed ({job}):{msg}")
    return work / f"{job}.pdf"


def read_ndjson(p: Path):
    return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]


def svg_parts(svg: str, prefix: str):
    """viewBox, defs and body of a PyMuPDF SVG, with every id prefixed."""
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    body = svg[svg.index(">", svg.index("<svg")) + 1: svg.rindex("</svg>")]
    ids = set(re.findall(r'id="([^"]+)"', body))
    for i in sorted(ids, key=len, reverse=True):
        body = (body.replace(f'id="{i}"', f'id="{prefix}{i}"').replace(f'href="#{i}"', f'href="#{prefix}{i}"')
                    .replace(f"url(#{i})", f"url(#{prefix}{i})"))
    defs = "".join(re.findall(r"<defs>(.*?)</defs>", body, re.S))
    rest = re.sub(r"<defs>.*?</defs>", "", body, flags=re.S)
    return vb, defs.strip(), rest.strip()


def compress(names):
    """A-1-1 ... A-4-4 -> A-{1..4}-{1..4}; live:* boxes left out."""
    groups = {}
    for n in names:
        if n.startswith("live:"):
            continue
        key = re.sub(r"\d+", "#", n)
        groups.setdefault(key, []).append(re.findall(r"\d+", n))
    out = []
    for key, nums in groups.items():
        parts = key.split("#")
        s = parts[0]
        for i, p in enumerate(parts[1:]):
            vals = sorted({int(v[i]) for v in nums})
            s += (f"{{{vals[0]}..{vals[-1]}}}" if len(vals) > 1 and vals == list(range(vals[0], vals[-1] + 1))
                  else "{" + ",".join(map(str, vals)) + "}" if len(vals) > 1 else str(vals[0])) + p
        out.append(s)
    return ", ".join(out) or "none"


USE = re.compile(r'<use data-text="([^"]*)" xlink:href="#([^"]+)" transform="matrix\(([-\d.e]+),0,0,([-\d.e]+),([-\d.e]+),([-\d.e]+)\)" fill="#([0-9a-f]{6})"/>')


THEME_TOKENS = {
    "dark": dict(page="#333333", card="#404040", fg="#ffffff", muted="#a6a6a6", line="#5c5c5c", accent="#8dd3c7"),
    "light": dict(page="#f3f3f1", card="#ffffff", fg="#1f1f1f", muted="#6f6f6f", line="#dcdcdc", accent="#2a9d8f"),
}


def theme_css(themes):
    """CSS tokens for the standalone page: the first theme on :root, the other one
    under prefers-color-scheme and [data-theme], as the Artifact contract asks."""
    def block(t):
        v = THEME_TOKENS[t]
        show = "--show-d: inline; --show-l: none;" if t == "dark" else "--show-d: none; --show-l: inline;"
        return (f"--page: {v['page']}; --card: {v['card']}; --fg: {v['fg']}; --muted: {v['muted']}; "
                f"--line: {v['line']}; --accent: {v['accent']}; {show} color-scheme: {t};")
    first = themes[0]
    css = f":root {{ {block(first)} }}\n"
    if len(themes) > 1:
        other = themes[1]
        css += (f"  @media (prefers-color-scheme: {other}) {{ :root:not([data-theme=\"{first}\"]) {{ {block(other)} }} }}\n"
                f"  :root[data-theme=\"{other}\"] {{ {block(other)} }}\n  :root[data-theme=\"{first}\"] {{ {block(first)} }}\n")
    return css


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("tex"); ap.add_argument("js", nargs="?")
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--no-tex", action="store_true", help="reuse the last TeX output (only the .js changed)")
    ap.add_argument("--themes", default="", help="e.g. dark,light: also compile the scaffold in the other theme; "
                    "the figure then follows the page theme (first = the theme in the .tex)")
    ap.add_argument("--embed", action="store_true", help="also write <name>.live.html, a fragment for a page with several figures")
    ap.add_argument("--name", default="", help="figure name in the markup (default: the file name)")
    a = ap.parse_args()

    tex = Path(a.tex).resolve()
    js = Path(a.js).resolve() if a.js else tex.with_suffix(".js")
    if not js.exists():
        sys.exit(f"no figure spec: expected {js}")
    name, work = tex.stem, tex.parent / ".dllive"
    fname = re.sub(r"[^A-Za-z0-9_-]", "-", a.name or name)
    work.mkdir(exist_ok=True)
    src = tex.read_text()
    m = re.search(r"\\usepackage(?:\[([^\]]*)\])?\{dlviz\}", src)
    theme = "light" if m and m.group(1) and "light" in m.group(1).split(",") else "dark"
    themes = [theme] + [t for t in a.themes.split(",") if t and t != theme]
    for t in themes:
        if t not in THEME_TOKENS:
            sys.exit(f"unknown theme {t!r} (dark or light)")
    if "{dllive}" not in src:
        sys.exit(r"the .tex must \usepackage{dllive} (after dlviz)")
    if len(themes) > 1 and not m:
        sys.exit(r"--themes needs \usepackage[dark]{dlviz} (or [light]) in the .tex")

    # ---- 1. TeX: scaffold, then (if there are live slots) the glyph job --------
    if not a.no_tex:
        compile_tex(tex, f"{name}-scaffold", "", work)
    S = read_ndjson(work / f"{name}-scaffold.live.json")
    has_live = any(e.get("node", "").startswith("live:") for e in S)
    if has_live and not a.no_tex:
        compile_tex(tex, f"{name}-glyphs", r"\def\dlliveglyphs{}", work)
    # the scaffold in the other theme(s): same file with the dlviz option swapped
    for t in themes[1:]:
        if not a.no_tex:
            variant = work / f"{name}-{t}.tex"
            opts = [o for o in (m.group(1) or "").split(",") if o and o not in ("dark", "light")] + [t]
            variant.write_text(src[:m.start()] + rf"\usepackage[{','.join(opts)}]{{dlviz}}" + src[m.end():])
            compile_tex(variant, f"{name}-scaffold-{t}", "", work, extra=[tex.parent])

    frames = [e["frame"] for e in S if "frame" in e]
    if not frames:
        sys.exit("no frame exported: is there a tikzpicture, and is dllive loaded?")
    frame = frames[0]
    nodes = {e["node"]: {k: e[k] for k in ("sw", "ne", "c")} for e in S if "node" in e}

    page = pymupdf.open(work / f"{name}-scaffold.pdf")[0]
    W, H = page.rect.width, page.rect.height
    vb, sdefs, sbody = svg_parts(page.get_svg_image(text_as_path=True), f"{fname}-s")
    bodies = {theme: sbody}
    for t in themes[1:]:
        tp = pymupdf.open(work / f"{name}-scaffold-{t}.pdf")[0]
        tvb, tdefs, tbody = svg_parts(tp.get_svg_image(text_as_path=True), f"{fname}-{t[0]}")
        if [round(v, 1) for v in tvb] != [round(v, 1) for v in vb]:
            sys.exit(f"the {t} scaffold has a different size {tvb} from {vb}; fix the box with \\useasboundingbox")
        sdefs += tdefs
        bodies[t] = tbody
    bbw, bbh = frame["ne"][0] - frame["sw"][0], frame["ne"][1] - frame["sw"][1]
    frame["border"] = [round((W / PT_TO_BP - bbw) / 2, 4), round((H / PT_TO_BP - bbh) / 2, 4)]
    frame["k"] = PT_TO_BP
    # visible TeX text that runs past the page is cut off silently: say so
    spill = []
    for t in page.get_texttrace():
        if t.get("opacity", 1) == 0:
            continue
        x0, y0, x1, y1 = t["bbox"]
        if x0 < -0.5 or y0 < -0.5 or x1 > W + 0.5 or y1 > H + 0.5:
            spill.append("".join(chr(c[0]) for c in t["chars"])[:30])
    tex_warnings = [f"TeX text runs past the page (cut off): {s!r}; enlarge \\useasboundingbox or move it" for s in dict.fromkeys(spill)]

    # ---- 2. live slots: cut the ID-coloured glyphs out of the glyph job --------
    live, gdefs = {}, ""
    if has_live:
        G = read_ndjson(work / f"{name}-glyphs.live.json")
        slots = {e["n"]: e for e in G if "live" in e}
        gpage = pymupdf.open(work / f"{name}-glyphs.pdf")[0]
        gvb, gdefs_all, gbody = svg_parts(gpage.get_svg_image(text_as_path=True), f"{fname}-g")
        if [round(v, 2) for v in gvb] != [round(v, 2) for v in vb]:
            sys.exit(f"glyph job page size {gvb} differs from scaffold {vb}: the live text changed the bounding box. "
                     r"Fix the box with \useasboundingbox.")
        used = set()
        for ch, gid, s1, s2, x, y, fill in USE.findall(gbody):
            r, g, b = (int(fill[i:i + 2], 16) for i in (0, 2, 4))
            if g != 3 or b != 251 or r % 4:
                continue
            n = r // 4 - 1
            if n not in slots:
                continue
            e = slots[n]
            live.setdefault(e["live"], {"color": "#" + e["color"].lower(), "glyphs": []})["glyphs"].append(
                {"id": gid, "ch": html.unescape(ch), "s": round(float(s1), 5), "x": round(float(x), 4), "y": round(float(y), 4)})
            used.add(gid)
        for e in slots.values():
            if e["live"] not in live:
                sys.exit(f'live slot "{e["live"]}" produced no glyphs. Its text must not set its own colour '
                         r"(use text=<colour> on the node, not \textcolor inside it).")
        # each slot's colour in every theme (the scaffold jobs record it too)
        for t in themes:
            T = S if t == theme else read_ndjson(work / f"{name}-scaffold-{t}.live.json")
            for e in T:
                if "live" in e and e["live"] in live:
                    live[e["live"]].setdefault("colors", {})[t] = "#" + e["color"].lower()
        # keep only the glyph outlines the live slots use
        gdefs = "".join(m2.group(0) for m2 in re.finditer(r'<(path|symbol|g) id="([^"]+)".*?</\1>|<path id="([^"]+)"[^>]*/>', gdefs_all, re.S)
                        if (m2.group(2) or m2.group(3)) in used)

    data = {"theme": theme, "themes": themes, "vb": [vb[2], vb[3]], "frame": frame, "nodes": nodes, "live": live}
    (work / f"{name}.data.json").write_text(json.dumps(data))

    # ---- 3. run the spec under node: snapshots, tests, errors ------------------
    if not shutil.which("node"):
        sys.exit("node not found (needed to render snapshots)")
    r = subprocess.run(["node", str(SKILL / "scripts" / "snapshot.cjs"), str(work / f"{name}.data.json"),
                        str(ASSETS / "dllive.js"), str(js)], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"snapshot.cjs crashed:\n{r.stderr[-1500:]}")
    res = json.loads(r.stdout)
    for e in res["errors"]:
        print("ERROR", e, file=sys.stderr)
    if res["errors"]:
        sys.exit(1)

    defs = sdefs + gdefs
    def full_svg(overlay, t):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                f'width="{vb[2]}" height="{vb[3]}" viewBox="{" ".join(map(str, vb))}"><defs>{defs}</defs>'
                f'<g>{bodies[t]}</g><g>{overlay}</g></svg>')
    # PNGs: the overlay (as a transparent vector page) stamped onto the scaffold PDF
    # itself, so everything TeX did (\clip included) shows exactly as in the browser.
    scaffold_pdf = {t: work / (f"{name}-scaffold.pdf" if t == theme else f"{name}-scaffold-{t}.pdf") for t in themes}
    def snapshot_png(overlay, t, dest):
        ov = (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
              f'width="{vb[2]}" height="{vb[3]}" viewBox="{" ".join(map(str, vb))}"><defs>{gdefs}</defs>{overlay}</svg>')
        layer = pymupdf.open("pdf", pymupdf.open(stream=ov.encode(), filetype="svg").convert_to_pdf())
        doc = pymupdf.open()
        doc.insert_pdf(pymupdf.open(scaffold_pdf[t]))
        doc[0].show_pdf_page(doc[0].rect, layer, 0)
        doc[0].get_pixmap(dpi=a.dpi).save(dest)
    outs = []
    for snap in res["snapshots"]:
        t = snap.get("theme", theme)
        overlay = re.sub(r'<rect class="dl-hot"[^>]*/>', "", snap["svg"])
        stem = name if snap["name"] == "default" else f"{name}.{snap['name']}"
        if t != theme:
            stem = f"{name}-{t}"
        if snap["name"] == "default" and t == theme:
            (tex.parent / f"{name}.svg").write_text(full_svg(overlay, t))
        snapshot_png(overlay, t, tex.parent / f"{stem}.png")
        outs.append(f"{stem}.png")

    # ---- 4. markup: the figure, as a standalone page and (--embed) a fragment -------
    meta = res["meta"]
    scaffold = "".join(f'<g class="dl-scaffold dl-th-{t}">{bodies[t]}</g>' for t in themes)
    overlay = res["snapshots"][0]["svg"] if res["snapshots"] else ""
    data_json = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    figure = (f'<div class="dl-live" data-dl="{fname}">'
              f'<svg class="dl-svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
              f'viewBox="{" ".join(map(str, vb))}" role="img" aria-label="{html.escape(meta["alt"] or name)}">'
              f'<defs>{defs}</defs>{scaffold}<g class="dl-overlay">{overlay}</g></svg>'
              f'<div class="dl-controls"><div class="dl-sliders"></div><div class="dl-buttons"></div></div>'
              f'<script type="application/json" class="dl-data">{data_json}</script></div>')
    spec_src = js.read_text().replace("</script", "<\\/script")
    fill = dict(TITLE=html.escape(meta["title"] or name), HEADER=f"<h1>{meta['title']}</h1>" if meta["title"] else "",
                CAPTION=meta["caption"], MAXW=str(int(min(1100, max(560, vb[2] * 2.3)))),
                THEME_CSS=theme_css(themes), HTML_THEME="" if len(themes) > 1 else f' data-theme="{theme}"',
                FIGURE=figure, RUNTIME=(ASSETS / "dllive.js").read_text().replace("</script", "<\\/script"), SPEC=spec_src)
    page_html = (ASSETS / "template.html").read_text()
    for k, v in fill.items():
        page_html = page_html.replace("{{" + k + "}}", v)
    (tex.parent / f"{name}.html").write_text(page_html)
    written = [f"{name}.html ({len(page_html) // 1024} KB)"]
    if a.embed:
        frag = (f"<!-- live figure {fname}: built by tikz-live from {tex.name} + {js.name}; needs dllive.js on the page -->\n"
                f"{figure}\n<script>DLLive.load({json.dumps(fname)}, function (DLLive) {{\n{spec_src}\n}});</script>\n")
        (tex.parent / f"{name}.live.html").write_text(frag)
        written.append(f"{name}.live.html ({len(frag) // 1024} KB)")

    # ---- 5. report ------------------------------------------------------------------------
    print(f"themes {','.join(themes)} | viewBox {vb[2]:.1f} x {vb[3]:.1f} | "
          f"{sum(not k.startswith('live:') for k in nodes)} exported nodes | live slots: "
          + (", ".join(f"{k} ({'number' if len(v['glyphs']) == 27 else str(len(v['glyphs'])) + ' glyphs'})" for k, v in live.items()) or "none"))
    for t in res["tests"]:
        print(("PASS " if t["ok"] else "FAIL ") + t["name"] + ("" if t["ok"] else f": {t['msg']}"))
    print("exported: " + compress(nodes))
    if "hotspots" in meta:
        print(f"hotspots: {meta['hotspots']} nodes")
    for w in tex_warnings + list(dict.fromkeys(res["warnings"])):
        print("WARN", w)
    print(f"wrote {', '.join(written)}, {name}.svg, " + ", ".join(outs))
    if any(not t["ok"] for t in res["tests"]):
        sys.exit(1)


if __name__ == "__main__":
    main()
