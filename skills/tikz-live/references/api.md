# tikz-live API

## Contents
1. TeX side (`dllive.sty`)
2. Spec (`DLLive.figure({...})`)
3. State
4. Drawing API (`d`)
5. Numbers
6. Colours and widths
7. Build output and checks

## 1. TeX side

Load after dlviz: `\usepackage[dark]{dlviz}` then `\usepackage{dllive}`. One
`tikzpicture` per file.

| Key / macro | Effect |
|---|---|
| `export` (node key) | Writes the node's box (south west, north east, centre) to JSON. JS refers to it by the node's name: `"A-3-2"`, `"A-3-2.north east"`. The node needs a name. Works inside `\foreach` (`(A-\i-\j)`). |
| `\node[fit=(a)(b), inner sep=0, export] (row-1) {};` | An invisible box spanning several nodes: the usual way to make a row hotspot or a highlight target. |
| `live=<id>` (node key) | The node's text is live. Scaffold job: invisible but laid out. Glyph job: typeset in a unique ID colour, so its glyphs are cut out and handed to JS. Its colour comes from `text=`, and its size from `font=`. The box is also exported as `live:<id>`. |
| `\dlnum` | The canonical number sample. A live number node contains exactly `\(\dlnum\)`. |
| `\dlnumin{w}` | The same sample in a box of width `w` (it overflows invisibly). Use it where layout matters: `\matrix` cells (`\|[live=w11]\| \dlnumin{2em}`), tables, inline after text. |
| `\dlexport{name}{(x,y)}` | Exports a bare point. |
| `\useasboundingbox` | Not part of dllive, but **required**: the page is cut to this box, and the live drawing must fit inside it. |

Node boxes are written at the end of the picture, so `export` also works on
cells of a `\matrix` (`|[export]| a`): the cell is `<matrix name>-<row>-<col>`.

**Live numbers inside a bracketed matrix.** A live node is a whole node, so a
matrix written in maths (`bmatrix`) can't hold one. Use a TikZ matrix with
delimiters:

```latex
\matrix[matrix of math nodes, left delimiter={[}, right delimiter={]},
        nodes={minimum width=8mm, anchor=center}, column sep=1mm] (W) at (0,0)
  { |[live=w11, export, text=colororange]| \dlnumin{2em} & |[live=w12, export, text=colorblue]| \dlnumin{2em} \\
    |[live=w21, export, text=colororange]| \dlnumin{2em} & |[live=w22, export, text=colorblue]| \dlnumin{2em} \\ };
```
then `d.number("w11", v, {at: "W-1-1", digits: 2})` centres each value in its
exported cell `W-1-1`.

**Cells at a different pitch than the unit.** Choose the picture's `x=`/`y=` to
be the pitch of the main grid. For a second grid at another pitch, compute its
positions with a macro (`\def\p{8/7}` ... `at (\j*\p, ...)`) and refer to its
cells by name in JS rather than by raw coordinates.

The overlay uses the picture's top-level coordinates: whatever `x=`/`y=` the
`tikzpicture` sets. Coordinates inside a `shift`ed `scope` are not that system;
for those, export nodes and refer to them by name.

Limit: 62 live slots per figure.

## 2. Spec

`figure.js` (same basename as the `.tex`) calls `DLLive.figure(spec)` once.
Plain script, no imports. Helper functions above the call are fine.

| Field | Type | Meaning |
|---|---|---|
| `title` | string | Page heading and `<title>`. |
| `caption` | HTML string | Under the figure: how to interact and what to look for. |
| `alt` | string | Accessible label (defaults to the title). |
| `params` | `{name: {min, max, step, value, label, digits, hidden, log}}` | One slider each. `label` is shown in italic serif, so `"β"` works. `hidden: true` gives no slider (use it for a `play` param). `digits` sets the slider readout (by default derived from `step`). `log: true` makes a log-scale slider (`min > 0`; `step` in decades, default 0.1); the state still holds the value itself (ε = 1e-8, not −8), and the readout shows `1e-8`. |
| `handles` | `{name: {value: [x, y], min: [x, y], max: [x, y], snap, snapRadius, color, label, r, keyStep}}` | Draggable points in TikZ units. Mouse, touch and arrow keys (Shift for ×5). The state holds `[x, y]`. `snap: 0.1` snaps to a grid; `snap: [[x, y], ...]` snaps to those points within `snapRadius` (0.15), so the reader can hit special cases (det = 0, the identity) exactly. |
| `hotspots` | array of names, RegExp, or `name => bool` | Exported nodes that set `state.hover` on hover, focus or tap. Tapping again clears it on touch. |
| `stickyHover` | bool | Keep the last hovered item when the pointer leaves. |
| `initial` | object | Overrides of the default state, e.g. `{hover: "H-2-2"}`, so the figure opens (and the default PNG shows) the interesting state. Pair it with `stickyHover: true`. |
| `play` | `{param, ms}` | Adds a ▶ Play button that steps `param` from min to max, `ms` per step. |
| `compute(s)` | `s => object` | Pure maths. Memoised: it runs again only when a param or handle changes (not on hover). |
| `draw(d, s, c)` | | Draws the live part with `d`. `c` is `compute(s)`. |
| `snapshots` | `[{name, ...stateOverrides}]` | Extra states rendered to `figure.<name>.png` at build time. |
| `tests` | `[{name, state, check: (c, s) => true \| "message"}]` | Run at build time. Return `true`, or a string saying what was wrong. |

## 3. State

`s` = `{ hover, ...params, ...handles }`: params are numbers, handles are
`[x, y]`, and `hover` is a node name or `null`. Snapshots and tests override any
of these: `{ beta: 0.95, w0: [3, -1], hover: "Qrow-3" }`.

## 4. Drawing API

Points are `[x, y]` in TikZ units, or a node reference: `"name"` (its centre)
or `"name.north east"` (also north, south, east, west, and the four corners).
Every call returns `d`, so calls can be chained.

| Call | Draws |
|---|---|
| `d.path(points, o)` | A polyline. `o.dots` (true = 1.1pt, or a radius in pt), `o.dotsFrom` (index, default 1), `o.dotColor`, `o.arrow` (Latex tip at the end), `o.closed` + `o.fill`. |
| `d.line(a, b, o)` | A segment. `o.bend: 30` curves it like TikZ `bend left=30` (negative = bend right). |
| `d.arrow(a, b, o)` | A segment with the dlviz Latex tip. `o.tipLength` / `o.tipWidth` in pt. |
| `d.dot(p, o)` | A filled dot, `o.r` in pt (default 1.6). |
| `d.circle(p, r, o)` | A circle outline, r in pt (or TikZ units with `o.rUnits: true`); `o.fill` fills it. |
| `d.rect(a, b, o)` | A rectangle between two corners. `o.fill`, `o.fillOpacity`, `o.color` + `o.width` (stroke), `o.round` in pt. |
| `d.hl(names, o)` | The dlviz `hl`: a red, very thick, 1pt-rounded outline around one node or the span of several. |
| `d.shade(names \| [a, b], o)` | Dims nodes by painting the page colour over them (`o.opacity`, default 0.6). |
| `d.number(id, v, o)` | A live number (see 5). |
| `d.label(id, o)` | A live label's glyphs as typeset. `{from, to}` moves it by to − from (TikZ units); `{dx, dy}` also works; `o.color`, `o.opacity`; `o.halo: true` (or an opacity) paints the page colour behind it, like dlviz's `knockout`. |
| `d.measure(id, v, o)` | `{left, right, baseline}` (TikZ units) of where `d.number(id, v, o)` would draw: use it to outline a number or place something after it. |
| `d.group(o, fn)` | `o.opacity`, and `o.clip: [a, b]` to clip to a rectangle. `fn(d)` draws inside. Clipping is geometric (paths, polygons, bent lines, rects, dots) so the PNGs show it too; numbers and labels are not clipped. |
| `d.box(name)` | `{sw, ne, c, w, h}` of an exported node, in TikZ units, for computing positions. |
| `d.X(p)` | The point in viewBox units, for `d.raw`. |
| `d.raw(svg)` | Raw SVG in viewBox units. Last resort. |
| `d.color(c)` | Resolves a colour spec to hex. |

Common options: `color`, `width` (a TikZ name or a number in pt), `opacity`,
`dash` (`true` for 3pt/3pt, or `[on, off]` in pt).

Drawing order is call order: draw fills first, then lines, then highlights, then numbers.

## 5. Numbers

`d.number(id, v, o)` composes `v` from the TeX glyphs of slot `id` (which must
contain `\(\dlnum\)`), so it is real Computer Modern at the slot's size and colour.

| Option | Effect |
|---|---|
| `digits: 2` | Fixed decimals: `0.60`. |
| (default) | Three significant figures between 1e-2 and 1e4 (`sig`, `sciBelow`, `sciAbove`), with trailing zeros dropped (`3`, `12`, `0.6`; `trim: false` keeps them). Outside that range it switches to scientific notation, `9.8 × 10⁻⁷` (`sciSig` significant figures). |
| `leadingZero: false` | `.64` instead of `0.64` (book style for weights). |
| `narrowMinus: true` | A 75%-wide minus, for tight cells. Prefer wider cells when you can. |
| `at: point, align` | Puts its `"center"` (default), `"left"` or `"right"` at the x of a point or node. Without `at`, the number starts where TeX placed the sample. |
| `align: "right"` (no `at`) | Right-aligns with the end of the sample. |
| `color` | Overrides the slot's colour (for example `"bg"` on a dark heatmap cell). |
| `dx, dy` | Shift in TikZ units. |

## 6. Colours and widths

Colours: `aqua yellow lavender red blue orange green pink gray violet mint gold`
(dlviz roles), `fg bg muted grid faint white black`, or `#rrggbb`. The `color` or
`dl` prefixes are accepted (`coloraqua`, `dlfg`). Mixing follows TikZ:
`"orange!55!bg"`, and `"red!40"` mixes with **white** as in TikZ, so on the dark
theme write `!bg`. The theme (dark or light) follows `\usepackage[light]{dlviz}`.

Widths (pt): ultra thin .1, very thin .2, thin .4, semithick .6, thick .8,
very thick 1.2, ultra thick 1.6, or a number. dlviz draws plots at 1.2pt and
cell outlines at `thick`.

## 7. Build output and checks

`build.py figure.tex [figure.js] [--no-tex] [--dpi N] [--themes dark,light] [--embed] [--name N]`
writes `figure.html`, `figure.svg`, `figure.png` and `figure.<snapshot>.png`
next to the `.tex`, and its intermediates (PDFs, SVGs, JSON) to `.dllive/`.
`--themes dark,light` also compiles the scaffold in the other theme (one more
pdflatex run) and writes `figure-light.png`; the figure then follows the page
theme. `--embed` writes `figure.live.html` for a page with several figures;
`--name` sets the figure's name in the markup (`DLLive.state(name)`).

In the browser console: `DLLive.mounted` (every figure on the page),
`DLLive.state(name)`, `DLLive.get(name).set({beta: 0.9})`.

It fails with a message naming the culprit for:

- a TeX error (the first one, with context);
- a live slot with no glyphs (a colour command inside the node);
- a different bounding box between the two jobs (no `\useasboundingbox`);
- an unknown node, slot, colour or anchor used in `draw`;
- a param value outside its range, or a handle without `[x, y]`;
- a JS exception in `compute` or `draw`;
- a failing test.

It also prints the exported node names (compressed: `A-{1..4}-{1..4}`) and how
many nodes the hotspots matched (zero is an error), and warns when drawn points
fall outside the page or visible TeX text runs past it. A clean build means the figure
is consistent; only the PNGs tell you whether it is *good*.
