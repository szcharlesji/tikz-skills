---
name: tikz-explorer-book
description: Build a figure-first "explorer" web book for a course, syllabus, reading list or research field. The home page is an interactive Obsidian-style concept map with a guided tour; it leads into chapters, each built around 2–3 computed TikZ figures with reading-guide captions, where the key mechanism of a chapter can be a live figure the reader drags, slides or hovers (tikz-live) while static figures come from tikz-dl-visualizer. The result is published as one web page. Use this skill whenever someone wants a visual companion, illustrated notes, a study guide, a "book", a concept map or mind map of a field, or a big-picture overview that connects the ideas and papers everyone should know before going deep. Typical asks are "make a book for this course", "help me see the big picture of X", "illustrated guide to the papers on this syllabus", "something like Obsidian for generative models", "chapters with diagrams for each week". Use it even if they never say TikZ, and especially when they say diagrams and intuition matter more than text.
---

# TikZ explorer book

You are making a book that someone will *explore*: a single web page whose
home is a concept map of the whole field, and whose chapters each make one
idea visible with carefully computed TikZ figures. The reader wants to see the
landscape first, connect the dots, then go deep where they choose.

Visualization is the priority. A chapter is its figures. Text leads into a
figure and draws the conclusion out of it; it never substitutes for a figure
that could show the same thing. When you trade off time, keep figure quality
and cut prose.

This skill orchestrates; the figure craft lives in two sibling skills that
share one visual language (`dlviz.sty`, colour = role). They ship together and
sit next to this skill's folder; below, `<skills>` means the folder that holds
all three (this skill's parent folder, wherever it is installed):

- **tikz-dl-visualizer** (`<skills>/tikz-dl-visualizer/`): static
  figures. Its style file, archetypes and render script define what a good
  figure is. Most figures in a book are static.
- **tikz-live** (`<skills>/tikz-live/`): live figures. A TikZ scaffold
  compiled by pdflatex plus a small JS spec that draws the moving part, so the
  reader can drag a start point, slide a temperature or hover a token while
  every label stays real TeX. The book inlines them and they follow its
  light/dark theme.

Read both SKILL.md files once before planning, so you know what a good figure
is and when interaction earns its place.

## What you deliver

```
<book>/
├── book.json            title, parts, chapter ids, colour roles, map settings
├── SPEC.md              the contract every chapter author follows
├── chapters/00-front.html   hero, map slot, how-to-read, conventions, legend
├── chapters/<cid>.html  one <section class="chapter"> per chapter
├── figs/<cid>-<slug>.tex/.png/-light.png/.pdf
├── figs/<cid>-<slug>.js     live figures only: the spec; fig.sh also writes
│                            .live.html (inlined by the build), .html (standalone)
│                            and <slug>.<snapshot>.png (for review)
├── scripts/<cid>-<slug>.py  the Python behind every number in a figure
├── map/data.json        concept map: families, concepts, key works, links, tour
├── tools/               build.py, shell.html (page design), fig.sh, dllive.js (live runtime)
└── index.html, preview.html   built page (publish index.html)
```

Requirements: a TeX install with TikZ/pgfplots (`pdflatex`), Ghostscript or
poppler for PNGs, ImageMagick for contact sheets, `uv` (or Python with
numpy/scipy) for figure numbers, and for live figures `node` plus PyMuPDF
(`uv run --with pymupdf`, which fig.sh does for you). The page loads MathJax
(jsDelivr) and d3 (cdnjs). Check `which pdflatex gs magick uv node` early; if
TeX packages are missing, tell the user the `tlmgr install` command instead of
installing.

## Workflow

### 1. Understand the source and the reader

Read the source (fetch the course calendar or syllabus, list the readings).
Then pin down the reader: what they already know (skip the basics they know,
but still draw the fundamentals well) and what they are aiming at (a job, an
exam, a research direction). The aim decides the shape of the book:

- **Part I follows the source**, one chapter per session or unit. Each goes
  *deep on one idea* rather than summarising everything.
- **Part II is a toolkit for the reader's goal**, e.g. "what a video-generation
  researcher must know": the cross-cutting fundamentals the source assumes or
  skips, practical and current, with real numbers. Skip Part II if the reader
  has no goal beyond the source.
- **The home page is a concept map**: the big picture before any depth.

Ask the user only when the aim is genuinely unclear; otherwise state your
reading of it in one line and go.

### 2. Plan chapters around figures

For each chapter write a brief: the deep thread (one sentence), 2–3 figures
with what each must make visible, which archetype, and what to compute. This
is the most important step. Briefs that name the mechanism give great figures;
briefs that name a topic give box diagrams.

- Weak: "figure about classifier-free guidance".
- Strong: "1-D two-class mixture; integrate the guided ODE with exact
  velocities for w = 0, 1, 2, 4; small multiples of the resulting densities
  against p(x|c) and the tilted density, showing guidance overshoots the tilt."

Good figure subjects: a mechanism in action (paths, flows, updates), a
before/after, a comparison of two methods on identical inputs, shapes and
counts (tensor shapes, token counts, FLOPs), a numerical experiment whose
result is the point. Each must be computable: the author will produce every
number in Python.

**Decide which figures are live.** A figure earns interaction when the reader
learns by *changing* something and watching the mechanism respond, in a way a
static picture or small multiples cannot show as well. Write its interaction
sentence in the brief: "the reader drags X / slides Y / hovers Z and sees W".
Budget: about one live figure per chapter, for the chapter's headline
mechanism; everything else static. Good candidates: optimizer paths (drag the
start, slide β), attention or convolution (hover a row or cell), a guidance
weight or temperature sweep, a linear map (drag the basis vectors), sampling
steps (play). Poor ones: pipelines, architecture diagrams, anything where
small multiples already show the trend.

- Live brief: "1-D two-class mixture; the reader slides the guidance weight w
  from 0 to 6 and sees the guided density overshoot the tilted target; a play
  button integrates the ODE step by step; numbers: KL to the target, live."

Also decide, once, for the whole book: the **colour roles** (which colour
means what; put them in `book.json` so figures, prose maths and the legend
agree), the **conventions** the field disagrees on (time direction, signs,
notation, and symbols that mean different things in different chapters, such
as \(v\) for momentum's velocity and Adam's second moment), and the chapter ids (`w01`…, `v01`…; the letter becomes the figure
label prefix, W3.2, V5.1).

### 3. Scaffold

```bash
python3 <skill>/scripts/init_book.py <book> --title "Book Title" --sub "Source · Term"
```

Edit `book.json` (parts, chapter ids, roles) and `chapters/00-front.html`;
read each first, since the file tools refuse to overwrite a file you have not
read. The template's roles are generic deep-learning ones (input, hidden,
latent...): replace them with the field's own (for optimizers: iterate,
gradient, velocity, loss...). Write `<book>/SPEC.md`
from `references/author-spec.md`, filling in every `«…»` block: reader, parts,
roles table, conventions, chapter map. Authors see only SPEC.md and their
brief, so SPEC.md must stand alone. Write it even when you author the book
yourself: it is where the conventions live for later chapters and later
sessions.

Before launching anyone, render one throwaway figure through
`bash <book>/tools/fig.sh` to prove the TeX pipeline works, and, if the plan has
live figures, one live figure too: copy `<skills>/tikz-live/assets/examples/momentum/momentum.{tex,js}`
into `figs/_test/`, run `bash <book>/tools/fig.sh figs/_test/momentum.tex`, then
`rm -rf <book>/figs/_test` (its intermediates live in `figs/_test/.dllive/`, so
nothing is left behind). That proves node and PyMuPDF work and puts
`tools/dllive.js` in place. A broken pipeline
discovered by nine parallel authors costs nine times as much.

### 4. Delegate the chapters

For a full course (10+ chapters), spawn general-purpose subagents in parallel,
each owning 2–4 related chapters (about 5–7 figures). Each prompt says: read
`<book>/SPEC.md` first and follow it; the chapter ids it owns; per chapter, the
session metadata, papers, the deep thread and the figure briefs; render, look,
fix, then report per SPEC section 5. Group related chapters under one author
so shared figures stay consistent (e.g. dynamic OT with OT couplings).

Usage limits are real: nine authors at once can exhaust a session limit
mid-run. If agents stop with a rate-limit error, their files are kept. Resume
each with SendMessage ("continue from where you stopped; check what you
already made") once the limit resets, instead of starting new agents. For
large books, consider launching in two waves.

For a small book (one topic, 3–5 chapters) skip subagents and write it
yourself, still following SPEC.md.

### 5. While authors draw: front matter and the map

Write `chapters/00-front.html` (hero, how to read, the conventions, the
`<!--ROLES-->` legend, optionally a table mirroring the source, e.g. the course
calendar with chapter links) and `map/data.json`. Read
`references/concept-map.md` for the schema and how to choose families, nodes,
relations and the tour. The map is an overview: what each idea is, where it
sits, how it relates, and which chapter goes deeper. Do not explain mechanisms
there.

### 6. Review as reports arrive

Each report lists its figures' one-idea sentences and its unverified claims.
Open the most important figures yourself (the headline comparison, anything
the user asked for by name) and check them against the facts you know. Send
concrete fixes back to the author who drew it.

### 7. Assemble, check, read

```bash
python3 <book>/tools/build.py
python3 <skill>/scripts/check_book.py <book> --sheet
```

Then follow `references/qa-and-publish.md`: contact-sheet glance, browser
checks (maths errors, phone-width overflow, map, light mode, live figures:
all mounted, drag and hover work, the theme toggle recolours them), and read
every chapter's text before publishing. Fix metadata slips (session numbers, dates)
that authors inherit from your briefs.

Do not skip the browser check. The static checks cannot run the page's
JavaScript, and the failures that matter most are silent: a map that never
renders, maths that stops typesetting. If you truly cannot open a browser,
say so in the handover and list the browser checks as not done.

### 8. Publish

Publish `<book>/index.html` as an Artifact with every figure PNG as a
supporting file (`check_book.py --files-json` prints the list; live figures
are inlined in the page, so their PNGs are left out), or hand over the folder
if no Artifact tool exists. Tell the user what is in each part, what
is unverified, which figures are illustrations rather than computed results,
and how to rebuild (`python3 tools/build.py`) or re-render a figure.

## Later requests

Edit the same folder and republish the same file path, so the link stays the
same: add a chapter (append its id in `book.json`), extend the map (edit
`map/data.json`), or restyle (edit `tools/shell.html`). Keep the fixes listed
in `references/qa-and-publish.md` §3 when you touch the shell or `map.js`.

## Reference files

- `references/author-spec.md` — the template for `SPEC.md`, the chapter
  authors' contract (figure rules, HTML fragment format, citation rules).
- `references/concept-map.md` — `map/data.json` schema and how to write a map
  that connects the dots.
- `references/qa-and-publish.md` — checks, browser snippets, known traps
  already fixed in the template, publishing.
- `assets/template/` — the book skeleton `init_book.py` copies.
