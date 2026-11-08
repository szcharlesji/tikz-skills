#!/usr/bin/env python3
"""Assemble the explorer book from chapter fragments.

    python3 tools/build.py            (run from anywhere; paths are relative to this file)

Reads book.json for the title, parts, chapter order, colour roles and map
settings, then:
  - numbers figures per chapter and swaps each image for a dark/light pair,
  - builds the contents rail (front matter + one list per part),
  - renders the concept map section (if map/data.json exists and the map is enabled),
  - writes index.html (the Artifact page, no doctype; the publisher wraps it)
    and preview.html (the same page with a doctype, for local viewing).
Missing chapters are listed and skipped, so the book builds at any stage.
"""
import html
import json
import re
import struct
import sys
from pathlib import Path

BOOK = Path(__file__).resolve().parent.parent
CH = BOOK / "chapters"

# map family colours, in order; a family in data.json may override with "dark"/"light"
FAMILY_PALETTE = [
    ("#BEBADA", "#7468B0"), ("#FCCDE5", "#D45D99"), ("#80B1D3", "#3A7DB5"),
    ("#B3DE69", "#5E9A1E"), ("#8DD3C7", "#2A9D8F"), ("#FFED6F", "#B58900"),
    ("#FDB462", "#E8862A"), ("#FB8072", "#E0533F"), ("#BC80BD", "#944A95"),
    ("#E5C494", "#8C6D3F"), ("#CCEBC5", "#4DA05A"), ("#D9D9D9", "#7F7F7F"),
]


def esc(s):
    return html.escape(str(s), quote=True)


def png_size(p: Path):
    with p.open("rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def chapter_meta(text: str):
    sec = re.search(r'<section[^>]*class="chapter"[^>]*>', text)
    attrs = dict(re.findall(r'([\w-]+)="([^"]*)"', sec.group(0))) if sec else {}
    h2 = re.search(r"<h2[^>]*>(.*?)</h2>", text, re.S)
    title = re.sub(r"<[^>]+>", "", h2.group(1)).strip() if h2 else attrs.get("id")
    return attrs, title


def chapter_label(cid: str) -> str:
    """w03 -> W3, v12 -> V12, ch7 -> CH7."""
    m = re.match(r"([A-Za-z]+)0*(\d+)$", cid)
    return (m.group(1).upper() + m.group(2)) if m else cid.upper()


LIVE = {"n": 0}   # live figures inlined so far (the runtime is added once)


def live_figure(src: str):
    """figs/x.png with a figs/x.live.html next to it -> the live fragment, sized like the PNG."""
    frag = BOOK / src.replace(".png", ".live.html")
    if not src.endswith(".png") or not frag.exists():
        return None
    dark = BOOK / src
    w, _ = png_size(dark) if dark.exists() else (1200, 0)
    LIVE["n"] += 1
    body = frag.read_text()
    if dark.exists() and frag.stat().st_mtime + 1 < dark.stat().st_mtime:
        print(f"note: {frag.name} is older than {dark.name}; re-render with tools/fig.sh")
    return f'<div class="live-plate" style="--w:{round(w / 1.3)}px">{body}</div>'


def number_figures(text: str, label: str, missing: list):
    count = 0

    def fig(m):
        nonlocal count
        count += 1
        body = m.group(2)

        def img(mi):
            tag = mi.group(0)
            src = re.search(r'src="([^"]+)"', tag).group(1)
            alt = re.search(r'alt="([^"]*)"', tag)
            alt = alt.group(1) if alt else ""
            live = live_figure(src)
            if live:
                return live
            dark = BOOK / src
            light_src = src.replace(".png", "-light.png")
            if not dark.exists():
                missing.append(src)
                return f'<div class="fig-missing">missing {src}</div>'
            w, h = png_size(dark)
            # show figures at ~1.3 device px per css px of the 200 dpi render
            cw, chh = round(w / 1.3), round(h / 1.3)
            size = f'width="{cw}" height="{chh}" style="--w:{cw}px"'
            out = f'<img class="th-d" src="{src}" alt="{alt}" {size} loading="lazy" decoding="async">'
            if (BOOK / light_src).exists():
                out += f'<img class="th-l" src="{light_src}" alt="{alt}" {size} loading="lazy" decoding="async">'
            return f'<button class="zoom" type="button" aria-label="Enlarge figure">{out}</button>'

        body = re.sub(r"<img\b[^>]*>", img, body)
        body = re.sub(r"<figcaption>",
                      f'<figcaption><span class="fig-no">Figure {label}.{count}</span> ', body, count=1)
        return m.group(1) + body + "</figure>"

    text = re.sub(r'(<figure\b[^>]*>)(.*?)</figure>', fig, text, flags=re.S)
    return text, count


def role_tokens(roles):
    dark = "  " + " ".join(f"--r-{r['macro']}: {r['dark']};" for r in roles)
    light = "    " + " ".join(f"--r-{r['macro']}: {r['light']};" for r in roles)
    css = "\n".join(f".c-{r['macro']} {{ color: var(--r-{r['macro']}); fill: var(--r-{r['macro']}); }} "
                    f".sw-{r['macro']} {{ background: var(--r-{r['macro']}); }}" for r in roles)
    macros = ",\n".join(f'      {r["macro"]}: ["\\\\class{{c-{r["macro"]}}}{{#1}}", 1]' for r in roles)
    legend = ('<ul class="legend">' + "".join(
        f'<li><span class="sw sw-{r["macro"]}"></span><span>{r["label"]}</span></li>' for r in roles) + "</ul>")
    return dark, light, css, macros, legend


def family_tokens(families):
    dark, light, css = [], [], []
    for i, f in enumerate(families):
        d, l = FAMILY_PALETTE[i % len(FAMILY_PALETTE)]
        d, l = f.get("dark", d), f.get("light", l)
        dark.append(f"--f-{f['id']}: {d};")
        light.append(f"--f-{f['id']}: {l};")
        css.append(f".f-{f['id']} {{ --fc: var(--f-{f['id']}); }}")
    return "  " + " ".join(dark), "    " + " ".join(light), " ".join(css)


def map_section(cfg, data, titles):
    """Toolbar, canvas, panel, legend, and a static index of every concept with
    its key works (readable without JavaScript)."""
    nodes = {n["id"]: n for n in data["nodes"]}
    works_of = {}
    for s, t, _ in data["links"]:
        if nodes[s]["type"] == "paper" and nodes[t]["type"] == "concept":
            works_of.setdefault(t, []).append(nodes[s])
    legend = "".join(
        f'<button type="button" class="m-fam f-{f["id"]}" data-fam="{f["id"]}" aria-pressed="false" '
        f'title="{esc(f["blurb"])}"><span class="m-dot f-{f["id"]}"></span>{esc(f["label"])}</button>'
        for f in data["families"])
    options = "".join(f'<option value="{esc(n["label"])}"></option>' for n in data["nodes"])
    index = []
    for f in data["families"]:
        items = []
        for n in data["nodes"]:
            if n.get("fam") != f["id"] or n["type"] != "concept":
                continue
            ws = sorted(works_of.get(n["id"], []), key=lambda p: p.get("year", 0))
            wl = ", ".join(f'{esc(p.get("who", p["label"]).split(" ")[0].rstrip(","))} {p.get("year", "")}'.strip() for p in ws)
            items.append(f'<li><button type="button" class="m-link-btn" data-node="{n["id"]}">{esc(n["label"])}</button>'
                         + (f' <span class="mi-p">{wl}</span>' if wl else "") + "</li>")
        index.append(f'<div class="mi-fam"><h4><span class="m-dot f-{f["id"]}"></span>{esc(f["label"])}</h4>'
                     f'<p class="mi-b">{esc(f["blurb"])}</p><ul>{"".join(items)}</ul></div>')
    nc = sum(n["type"] == "concept" for n in data["nodes"])
    nw = sum(n["type"] == "paper" for n in data["nodes"])
    intro = cfg.get("intro") or (
        f"Before going deep into one branch, see how the branches connect: {nc} core concepts and {nw} "
        "key works, linked by how the ideas relate. Each node says what an idea is and where it sits, "
        "and points to the chapter that explains how it works.")
    data_json = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    titles_json = json.dumps(titles, ensure_ascii=False).replace("</", "<\\/")
    steps = len(data.get("tour", []))
    return f'''<section class="front mapsec" id="map">
  <h2>{esc(cfg.get("heading", "The big picture"))}</h2>
  <p>{intro}</p>
  <div class="map-wrap">
    <div class="map-bar">
      <div class="map-tour">
        <button type="button" class="map-btn" id="tourPrev" aria-label="Previous tour step">‹</button>
        <span class="map-step" id="tourLabel" aria-live="polite">Tour: {steps} steps</span>
        <button type="button" class="map-btn" id="tourNext" aria-label="Next tour step">›</button>
      </div>
      <div class="map-tools">
        <label class="map-search"><span class="sr">Find a concept or work</span><input id="mapSearch" type="search" list="mapOptions" placeholder="Find a concept or work" autocomplete="off"></label>
        <datalist id="mapOptions">{options}</datalist>
        <button type="button" class="map-btn" id="mapPapers" aria-pressed="false">Key works</button>
        <button type="button" class="map-btn" id="mapReset">Whole map</button>
      </div>
    </div>
    <div class="map-body">
      <div class="map-canvas" id="mapCanvas"><p class="map-fallback">The interactive map needs JavaScript. Every concept is also listed below.</p></div>
      <aside class="map-panel" id="mapPanel" aria-live="polite"></aside>
    </div>
    <div class="map-legend">{legend}</div>
  </div>
  <div class="map-index">{"".join(index)}</div>
  <script type="application/json" id="mapData">{data_json}</script>
  <script type="application/json" id="chapterTitles">{titles_json}</script>
</section>'''


def live_runtime():
    """The tikz-live runtime, once, before the first live figure (tools/fig.sh keeps tools/dllive.js current)."""
    if not LIVE["n"]:
        return ""
    js = BOOK / "tools" / "dllive.js"
    if not js.exists():
        sys.exit("live figures need tools/dllive.js: render one live figure with tools/fig.sh, which copies it")
    return "<script>\n" + js.read_text().replace("</script", "<\\/script") + "\n</script>\n"


def main():
    cfg = json.loads((BOOK / "book.json").read_text())
    shell = (BOOK / "tools" / "shell.html").read_text()
    front = (CH / "00-front.html").read_text()
    roles = cfg.get("roles", [])
    map_cfg = cfg.get("map", {})
    data_file = BOOK / "map" / "data.json"
    use_map = map_cfg.get("enabled", True) and data_file.exists()
    data = json.loads(data_file.read_text()) if use_map else {"families": []}

    parts, toc, absent, missing, titles = [], [], [], [], {}
    nfig = 0
    for part in cfg["parts"]:
        items = []
        body = [f'<div class="part-head" id="part-{part["id"]}"><p class="part-k">{esc(part["kicker"])}</p>'
                f'<h2 class="part-t">{esc(part["title"])}</h2><p class="part-b">{esc(part.get("blurb", ""))}</p></div>']
        for cid in part["chapters"]:
            f = CH / f"{cid}.html"
            if not f.exists():
                absent.append(cid)
                continue
            text = f.read_text()
            _, title = chapter_meta(text)
            label = chapter_label(cid)
            text, k = number_figures(text, label, missing)
            nfig += k
            titles[cid] = title
            items.append(f'<li><a href="#{cid}" data-id="{cid}"><span class="toc-n">{label}</span>'
                         f'<span class="toc-t">{esc(title)}</span></a></li>')
            body.append(text)
        toc.append(f'<li class="toc-part"><a href="#part-{part["id"]}">{esc(part["kicker"])} · {esc(part["title"])}</a>'
                   f'<ol>{"".join(items)}</ol></li>')
        parts.append("\n".join(body))

    # front-matter contents: the map, then every <section class="front" id=".." data-toc="..">
    front_toc = []
    if use_map:
        front_toc.append((map_cfg.get("toc", "The big picture (map)"), "map"))
    for sid, label in re.findall(r'<section class="front"[^>]*id="([^"]+)"[^>]*data-toc="([^"]+)"', front):
        front_toc.append((label, sid))
    front_toc_html = "\n".join(
        f'            <li><a href="#{sid}" data-id="{sid}"><span class="toc-n">·</span><span class="toc-t">{esc(t)}</span></a></li>'
        for t, sid in front_toc)

    rd, rl, rcss, macros, legend = role_tokens(roles)
    fd, fl, fcss = family_tokens(data["families"])
    front = front.replace("<!--ROLES-->", legend)
    front = front.replace("<!--MAP-->", map_section(map_cfg, data, titles) if use_map else "")
    page = shell
    for key, val in {
        "{{TITLE}}": esc(cfg["title"]), "{{SUB}}": esc(cfg.get("sub", "")),
        "{{COLOPHON}}": cfg.get("colophon", ""), "{{FRONT_TOC}}": front_toc_html,
        "{{ROLES_DARK}}": rd, "{{ROLES_LIGHT}}": rl, "{{ROLE_CSS}}": rcss, "{{MJ_MACROS}}": macros,
        "{{FAMS_DARK}}": fd, "{{FAMS_LIGHT}}": fl, "{{FAM_CSS}}": fcss,
        "{{TOC}}": "\n".join(toc), "{{FRONT}}": front,
        "{{MAPJS}}": (BOOK / "map" / "map.js").read_text() if use_map else "",
        "{{CHAPTERS}}": live_runtime() + "\n".join(parts), "{{NFIG}}": f"{nfig} figure{'' if nfig == 1 else 's'}",
    }.items():
        page = page.replace(key, val)
    (BOOK / "index.html").write_text(page)
    (BOOK / "preview.html").write_text(
        '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        "</head><body>\n" + page + "\n</body></html>\n")
    print(f"built: {nfig} figures ({LIVE['n']} live); chapters missing: {absent or 'none'}")
    if missing:
        print("missing figure files:", missing)


if __name__ == "__main__":
    sys.exit(main())
