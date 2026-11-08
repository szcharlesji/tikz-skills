# QA and publishing

## Contents
1. Static checks
2. Browser checks (snippets)
3. Known traps, already fixed in the template
4. Reading the text before publishing
5. Publishing

## 1. Static checks

```bash
python3 <skill>/scripts/check_book.py <book> --sheet
```

Besides structure and links, it checks the maths fragments (a raw `<` inside
`\( \)` starts an HTML tag and silently eats the formula) and the map (exactly
one hub, every concept within three hops of it). Fix every PROBLEM. Then open `.qa/contact-*.png` (every dark figure on one
sheet) and look for a figure that is broken, empty, off-style or far smaller
than its neighbours. This is the fastest way to catch an author who shipped a
figure without looking at it.

## 2. Browser checks (snippets)

Serve the book folder on a port of your own (`python3 -m http.server <port>
--directory <book>`, run in the background, then `preview_start` with that
`url`; or a `.claude/launch.json` entry in your working directory) and open
`preview.html`. Servers left by earlier sessions may serve a different folder
on the usual ports: check that the page title is your book's. After a rebuild,
reload with a new query (`preview.html?v=2`), since the browser may keep the
old page. If the browser pane is hidden, screenshots time out: use DOM checks
(`get_page_text`, the snippets below) and say which visual checks you could not do. Run these in the page:

Maths errors (should be 0):
```js
await MathJax.startup.promise;
[...document.querySelectorAll('mjx-container')].filter(c => c.querySelector('[data-mjx-error]'))
  .map(e => e.closest('section')?.id + ': ' + e.querySelector('[data-mjx-error]').getAttribute('data-mjx-error'))
```

Horizontal overflow at phone width (resize to 375 px first; `sw` must equal `cw`):
```js
const cw = document.documentElement.clientWidth, out = [];
document.querySelectorAll('main *').forEach(e => { const r = e.getBoundingClientRect(); if (r.right > cw + 1) {
  let p = e.parentElement, clipped = false;
  while (p) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') { clipped = true; break; } p = p.parentElement; }
  if (!clipped) out.push(e.tagName + ' in ' + e.closest('section')?.id); } });
({sw: document.documentElement.scrollWidth, cw, out: out.slice(0, 10)})
```

Live figures (every one mounted, none failed; the count must match the
build's "N live"):
```js
({mounted: DLLive.mounted.map(m => m.name),
  failed: [...document.querySelectorAll('.dl-live:not([data-dl-mounted])')].map(e => e.dataset.dl)})
```
Then, for each live figure: move a slider, drag a handle, hover a hotspot,
press Play, and switch the theme with the page's Theme button (the scaffold
swaps and the overlay recolours; `DLLive.state("<name>")` shows the state).
Check one at phone width: the controls wrap and nothing overflows.

Also look at: the map at desktop and phone width, one tour step, one node
panel, a figure in light mode, and the figure lightbox.

Screenshots in the built-in browser can lag behind an animated zoom; if the
map looks unchanged after a click, check the DOM state (`.m-node.m-hi`)
before assuming a bug.

## 3. Known traps, already fixed in the template

Keep these fixes if you edit `tools/shell.html` or `map/map.js`:

- Display maths wider than the column overflowed the page: display
  `mjx-container` is a block with `overflow-x: auto`.
- Long inline maths cannot wrap with MathJax SVG output: after typesetting, a
  script marks inline formulas wider than their *nearest block ancestor* as
  `.mjx-wide` (own scrolling row). Measuring against the direct parent was a
  bug: an inline `<strong>` reports width 0, so every formula in bold text was
  pushed onto its own line.
- Hash links landed in the wrong place because typesetting changes the page
  height: the page jumps to `location.hash` again after MathJax's pageReady.
- The map SVG must be sized in screen pixels (viewBox = container size) with
  the zoom transform fitting the layout into it; a fixed viewBox made the
  graph tiny in narrow canvases. A ResizeObserver refits on width changes.
- On screens under 1500 px the map panel sits under the canvas so the graph
  gets the full column width.
- KaTeX needs a stylesheet and fonts, which the Artifact CSP blocks
  (stylesheets only from Google Fonts). The template uses MathJax 3 SVG
  output from jsDelivr, which needs neither. Role colours in prose maths use
  `\class{c-<macro>}` with CSS tokens, so they follow the theme.

## 4. Reading the text before publishing

Chapters are written by subagents. Read every chapter's text before you
publish (extract plain text from `chapters/*.html` and read it in chunks).
Look for: wrong facts, sign/convention slips across chapters, claims the
author flagged as unverified but stated as fact, copied boilerplate, and
session/date metadata that does not match the source. Fix small things
yourself; send larger rewrites back to the author with SendMessage.

## 5. Publishing

If the Artifact tool is available, publish `<book>/index.html` with every
figure PNG as a supporting file (published paths `figs/<name>.png`). Get the
list with `check_book.py <book> --files-json`, and pass it as `files` (a list
of `{"path": ...}` entries) while the working directory is the book folder.
Each PNG is ~100–250 KB; a 50-figure book is ~12 MB in both themes, inside the
limits. Live figures are inlined into `index.html` instead (~250–650 KB each,
both themes), so `--files-json` leaves their PNGs out. Republish the same `file_path` to keep the URL; files left out of a
later publish are kept.

Without the Artifact tool, deliver the folder: `preview.html` opens directly
in a browser (figures are relative paths).
