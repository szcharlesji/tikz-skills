---
name: tikz-live
description: Build an interactive, explorable figure in the TikZ/dlviz style (Canziani NYU-DL look) where the reader drags points, moves sliders, hovers rows or plays steps, while every static part stays real LaTeX typography. The static scaffold is compiled from TikZ, a small JS spec draws the live part in the same coordinates, and the build outputs one self-contained HTML page plus PNG snapshots to check. Use this whenever someone wants an interactive, live, explorable, draggable, animated, "play with it", slider or hover version of a technical or ML/DL diagram (optimizers, attention, convolution, linear maps, loss landscapes, sampling, normalization...), wants to make an existing TikZ figure interactive, or wants interactive figures for a web book, course notes, a blog or an artifact. For a static figure (slides, papers, print), use tikz-dl-visualizer; for a whole illustrated web book with many figures, use tikz-explorer-book, which builds its live figures with this skill.
---

# TikZ live figures

A live figure is a TikZ drawing that the reader can change. The point is the
same as for a static figure in `tikz-dl-visualizer` (one idea, made obvious),
but the reader now *does* something and watches the idea respond: drags the
start point and sees momentum cancel the zig-zag, lowers the temperature and
sees softmax collapse to argmax.

Every figure has two halves:

| file | holds | compiled by |
|---|---|---|
| `figure.tex` | everything that never changes: axes, contours, grids, matrices of fixed values, labels, the equation, and **slots** for the live text | pdflatex, once |
| `figure.js` | everything that changes: parameters, handles, hotspots, a pure `compute(state)`, and `draw(d, state, c)` | the browser, on every change |

`scripts/build.py` compiles the `.tex` twice (once normally, once with the live
text in ID colours so it can cut those glyphs out), exports the TikZ coordinate
frame and named node boxes, runs the spec under node, and writes:

- `figure.html`: one self-contained page (no network). Open it, iframe it, or publish it.
- `figure.png` plus `figure.<snapshot>.png`: the default state and each snapshot, rendered without a browser. **These are how you see your own work.**
- `figure.svg`: the default state as a static SVG, for papers and fallbacks.

Bundled:

- `assets/dlviz.sty`: the palette and TikZ styles (same file as tikz-dl-visualizer).
- `assets/dllive.sty`: TeX side, the `export` and `live=` keys and `\dlnum`.
- `assets/dllive.js`: runtime: coordinate map, drawing API, sliders, handles, hotspots, play.
- `assets/examples/momentum/`: params, a draggable handle, a play button, live numbers, a moving label.
- `assets/examples/attention/`: exported cells, hover hotspots, a heatmap, 29 live numbers, curves.
- `references/api.md`: the full API (TeX keys, spec fields, drawing calls). Read it before writing your first spec in a session.
- `references/gotchas.md`: problems we hit and their fixes. Read it when something looks off.

For the visual language itself (colour roles, notation, layout, annotations),
follow `tikz-dl-visualizer`: its `references/visual-language.md` and
`references/archetypes.md` apply unchanged. Read them if you have not this session.

## Workflow

### 1. Write the interaction sentence

Before any code, write one sentence of the form *"the reader does X and sees Y,
which shows Z"*:

- "Drag the start point and change β: the zig-zag across the valley cancels
  while the motion along it accumulates; too much β overshoots."
- "Hover a token: its row of A is the set of weights, and its output row is that
  weighted average of V's rows. Lower τ and the weights collapse onto one row."

If Y would be just as clear in a static figure, make a static one (tikz-dl-visualizer).
Use one to three controls. Each control must change something the eye can follow;
a slider whose effect you cannot see is noise.

### 2. Split static from live

Draw on paper what changes. Everything else goes in the `.tex`. Typical splits:

- **Static**: axes, contours, grids, cell outlines, fixed matrices, token labels,
  the equation, readout labels such as `\(\beta = {}\)`, legend strokes.
- **Live**: paths, points, highlights, heatmap fills, arrows, dimming, and
  numbers (as `\dlnum` slots, so they stay real TeX glyphs).
- A label that has to move (for example one attached to a handle) is a `live=`
  node too, moved with `d.label(id, {from, to})`.

### 3. Write `figure.tex`

Start from the closest example. Required:

```latex
\documentclass[tikz,border=8pt]{standalone}
\usepackage[dark]{dlviz}     % [light] for white pages
\usepackage{dllive}
\begin{document}
\begin{tikzpicture}[x=1.15cm, y=1.15cm]
  \useasboundingbox (xmin,ymin) rectangle (xmax,ymax);   % ALWAYS: live drawing must fit inside
  ...static drawing...
  \node[cell=coloraqua, export] (A-1-1) at (..) {};       % export: JS can address this box
  \node[fit=(Q-1-1)(Q-1-3), inner sep=0, export] (Qrow-1) {};   % invisible box for a hotspot
  \node[anchor=base west, inner sep=0, text=coloraqua] (b) at (..) {\(\beta = {}\)};
  \node[live=beta, anchor=base west, inner sep=0, text=coloraqua] at (b.base east) {\(\dlnum\)};
\end{tikzpicture}
\end{document}
```

- Set the scale with `x=`/`y=` (not `scale=`), so 1 unit in JS is 1 unit in TikZ.
- A live **number** node contains exactly `\(\dlnum\)`. Set its colour with
  `text=` and its size with `font=`; colour commands inside the node break it.
- Put numbers in table cells with `anchor=mid west` at the cell centre, then
  `d.number(id, v, {at: "cell"})` centres them. In a `\matrix` or anywhere
  layout matters, use `\dlnumin{2em}` so the slot reserves only that width.
- If the figure only makes sense with something selected, open it that way:
  `initial: {hover: "..."}` plus `stickyHover: true`.
- Name things so the JS can loop over them (`A-\i-\j`, `Qrow-\i`).
- Put a `% Caption:` comment at the top, as in tikz-dl-visualizer.

### 4. Write `figure.js`

```js
DLLive.figure({
  title: "...", caption: "...how to interact, one or two sentences...",
  params:  { beta: { label: "β", min: 0, max: 0.99, step: 0.01, value: 0.6 } },
  handles: { w0: { value: [-4, 1.5], min: [-5.2, -1.85], max: [5.2, 1.85] } },
  hotspots: /^Qrow-\d$/,                 // exported nodes that set state.hover
  play: { param: "t", ms: 110 },         // optional: animate a (hidden) param
  compute: (s) => ({ path: run(s.beta, s.w0) }),          // pure maths, memoised
  draw(d, s, c) {                                          // TikZ units, dlviz colours
    d.path(c.path, { color: "aqua", width: "thick", dots: true });
    d.number("beta", s.beta, { digits: 2 });
  },
  snapshots: [{ name: "overshoot", beta: 0.95 }],          // extra PNGs to check
  tests: [{ name: "matches numpy", state: { beta: 0.4 }, check: (c) => Math.abs(c.path[30][0] - 1.036e-5) < 1e-8 || `got ${c.path[30]}` }],
});
```

- **The maths lives in `compute`, and it must be right.** Write a reference in
  Python (numpy) first, then add a `tests` entry that compares the JS against a
  number you computed in Python. Never trust maths written in your head.
- `draw` only draws: no state changes, no randomness (use a seeded RNG in
  `compute` if you need noise), and it runs on every frame.
- Use dlviz colour roles (`aqua`, `red`, `orange!55!bg`...) and TikZ widths
  (`thin`, `thick`, `very thick`), so the overlay looks like the scaffold.
- Add a snapshot for every state that matters: an extreme of each slider, a
  hover, mid-animation. That is where overlaps hide.

### 5. Build

```bash
uv run --with pymupdf python <skill-dir>/scripts/build.py path/to/figure.tex
```

It prints the exported node names and live slots, how many nodes the hotspots
matched, `PASS`/`FAIL` for each test, and `WARN` for drawing outside the page or
TeX text cut off at its edge. Errors name the slot, node or parameter at
fault. After a change to the `.js` only, add `--no-tex` (about 1 second).

### 6. Look, critique, iterate

Open every PNG it wrote (Read tool) and check, as for a static figure:

1. Does the live part line up with the scaffold (paths start at the right dot,
   numbers sit in their cells, highlights hug their rows)?
2. In every snapshot, does anything overlap: a path through a readout, a curve
   across numbers, text out of its cell, something clipped at the edge?
3. Do the controls' extremes still read well (β = 0.99, τ = 0.2, a handle in a corner)?
4. Can the eye find the idea in three seconds in the default state? The default
   state is what a thumbnail and a skimming reader see.
5. Colours keep their roles in both the scaffold and the overlay.

Fix and rebuild. Two or three rounds is normal.

Then try the real page if you have a browser (the built-in Browser pane): it
usually refuses `file://`, so serve the folder, for example with a
`.claude/launch.json` entry `{"name": "fig", "runtimeExecutable": "python3",
"runtimeArgs": ["-m", "http.server", "8800", "--directory", "<folder>"], "port": 8800}`
and `preview_start`. Drag, slide, hover and play; in the console,
`DLLive.state()` shows the current state. Snapshots don't show dashes or hover cursors.

### 7. Deliver

Give the user the PNG (default state), the path to `figure.html`, and a short
reading guide: what to try first and what to watch for ("Drag w₀ into the steep
direction, then raise β..."). If they want a shareable link, publish the HTML
as an Artifact; it is self-contained, so no extra files are needed. Mention the
natural next control or figure in one line.

## Embedding

- **Several figures on one page, or a page with its own light/dark theme**
  (tikz-explorer-book does this through its `tools/fig.sh`): build with
  `--themes dark,light --embed`. That compiles the scaffold in both themes and
  writes `figure.live.html`, a fragment (`<div class="dl-live">` plus a
  `<script>DLLive.load("name", ...)</script>`). The host page includes
  `assets/dllive.js` once before the fragments, and the CSS rules marked "live
  figure" in `assets/template.html`. It shows the scaffold for the current
  theme with `--show-d` / `--show-l`. The runtime follows the page theme
  (`data-theme="dark|light"` on `<html>`, or the system setting) and recolours
  the overlay. `-light.png` is written too.
- **Standalone or an Artifact**: `figure.html` as is. With `--themes dark,light`
  it follows the viewer's theme; otherwise it keeps the theme of the `.tex`.
- **Slides**: use `figure.png` / `figure.svg` for the static slide, and link the HTML.
- **Paper**: use `figure.svg` or the scaffold PDF in `.dllive/`; the static default
  state is a complete figure on its own. For print-only figures, tikz-dl-visualizer
  is the better tool.
