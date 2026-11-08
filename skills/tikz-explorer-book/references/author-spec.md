# Author spec template

Write `<book>/SPEC.md` from this template (write a fresh file rather than
copying and editing, which trips the read-before-overwrite rule), replacing
every `«…»` block with the book's specifics and leaving out this preamble.
`«SKILLS»` is the absolute path of the folder that holds this skill and its two
siblings (tikz-dl-visualizer, tikz-live). Every chapter author (subagent)
reads `SPEC.md` first, so it must be complete on its own: an author never sees
your conversation with the user.

---

# «Book title» — authoring spec (read fully before writing anything)

«Two or three sentences: the source (course URL, syllabus, reading list or
field), the reader (what they already know, what they want, e.g. "knows the
basics of X, wants a research job in Y"), and what the book is for.»

The book has «two» parts:

- **«Part I name»** (ids `«w01»`…`«w13»`). «e.g. One chapter per course
  session. Each goes deep on one idea from that session instead of summarising
  everything: pick the most illuminating thread, say what it is, and dig.»
- **«Part II name»** (ids `«v01»`…`«v14»`). «e.g. What someone with the
  reader's goal must know cold, practical and current, with real numbers from
  real systems. Where a topic has a deep dive in Part I, link to it.»

You are one of several authors working in parallel. You own only the chapters
assigned to you. Do not touch other files.

## 0. This book is figure-first

The figures are the chapter; the text exists to make them land. Plan each
chapter around its figures before writing prose: decide the one idea each
figure must make visible, draw it, critique it, and only then write the text
that leads into and out of it. A chapter with excellent figures and lean text
beats a chapter with long text and one passable figure. If you run short of
time, cut prose, not figure quality.

## 1. Files you produce

For each assigned chapter `<cid>`:

1. Figures: `«BOOK»/figs/<cid>-<slug>.tex` (e.g. `w03-marginal.tex`), rendered
   with
   ```bash
   bash «BOOK»/tools/fig.sh «BOOK»/figs/<cid>-<slug>.tex
   ```
   which writes `<cid>-<slug>.png` (dark, the one you review) and
   `<cid>-<slug>-light.png` (auto-generated light theme; look at it once to
   check nothing vanished, e.g. a hard-coded `white`).
   Python that computes figure numbers goes in `«BOOK»/scripts/<cid>-<slug>.py`
   (run with `uv run --with numpy,scipy python ...`; add libraries as needed).
   Every number in a figure comes from such a script, never from your head.
   Paste generated coordinates between `% BEGIN-DATA` / `% END-DATA` comments
   so the `.tex` stays self-contained.
2. Chapter text: `«BOOK»/chapters/<cid>.html`, an HTML fragment in the format
   of section 3.

## 2. Figures: the TikZ skill

Follow the skill at `«SKILLS»/tikz-dl-visualizer/`: read `SKILL.md`,
then `references/visual-language.md`, `references/archetypes.md` and
`references/tikz-gotchas.md`, and look at the PNGs in `assets/examples/` for
the quality bar. The skill's archetypes (pipeline, matrix/heatmap, grid +
receptive field, parameter-space geometry, small multiples, before/after warp)
fit far more than deep learning; pick the one that makes the idea visible.

Every figure:

- starts with `% Caption: ...`, `\documentclass[tikz,border=8pt]{standalone}`,
  `\usepackage[dark]{dlviz}` (exactly this line; the light build depends on it);
- delivers **one idea you can state in one sentence** (write it in a comment);
- uses real computed numbers, labels shapes or units, and puts the defining
  equation in the figure with each term coloured like its visual counterpart;
- is **12–20 cm wide** (shown at up to ~960 css px; wider shrinks text);
  no overall title inside the figure (the HTML caption does that); short panel
  labels like "(a) independent coupling" are fine;
- is critiqued after rendering: open the PNG, zoom into dense areas
  (`magick in.png -crop WxH+X+Y out.png`), fix overlaps, clipped labels, text
  on lines, wrong maths. Two to four rounds is normal. Never deliver a figure
  you have not looked at.

Aim for «2–3» figures per chapter (the brief says how many). Prefer figures
that show a mechanism over figures that show a box diagram of names. If the
honest picture is an illustration rather than a computed result (a toy
process, an embedding computed by a stand-in method), say so in the caption.

### Live figures (tikz-live)

Your brief marks a figure **live** when the reader should change something and
watch the mechanism respond (it gives an interaction sentence: "drag X, see Y").
Build those with the skill at `«SKILLS»/tikz-live/`: read its `SKILL.md`
and `references/api.md`, and start from the closest example in
`assets/examples/` (momentum: sliders, a draggable point, play; attention:
hover rows, live numbers in cells).

- Files: `figs/<cid>-<slug>.tex` (the static scaffold, with
  `\usepackage[dark]{dlviz}` then `\usepackage{dllive}`) and
  `figs/<cid>-<slug>.js` (the spec). Same name, side by side.
- Render with the same command, `bash «BOOK»/tools/fig.sh figs/<cid>-<slug>.tex`
  (add `--no-tex` when only the .js changed). It detects the live figure and
  builds it in both themes. Open every PNG it writes: `<id>.png` (default
  state), `<id>-light.png`, and one `<id>.<snapshot>.png` per snapshot. Fix
  overlaps in *every* snapshot, not only the default.
- The maths in `compute` must match your Python: compute reference values in
  `scripts/<cid>-<slug>.py` and assert them in the spec's `tests`. The build
  fails if a test fails.
- In the chapter HTML, write the figure exactly like a static one
  (`<img src="figs/<cid>-<slug>.png" ...>`); the book build swaps in the live
  figure. The caption's bold first sentence says what to do and what to watch
  ("Drag the start point into the steep direction, then raise β."). Leave the
  spec's own `title`/`caption` short; the book uses the figcaption.
- The default state must be a complete figure on its own: it is what a reader
  sees before touching anything and what the light/dark PNGs show. If the
  figure needs a selection, open with one (`initial: {hover: ...}`).
- One to three controls. Use dlviz colour names in the spec (`aqua`,
  `orange!55!bg`), never hex, so the overlay follows the book's light theme.
  For a parameter that spans decades (ε, a learning rate) use `log: true`.
- Keep live figures at the narrow end (12–15 cm): on a phone the whole figure,
  TeX text included, scales down to about 330 px wide.
- If you can open a browser (the built-in Browser pane), try `figs/<id>.html`:
  serve the folder (`python3 -m http.server`) since `file://` is usually refused.

### Book-wide colour roles (keep these everywhere)

| Role | dlviz colour | KaTeX/MathJax macro (prose) |
|---|---|---|
«one row per role in book.json, e.g.
| noise / source sample \(x_0\) | `colororange` | `\cn{}` |»

When a figure contrasts two methods or conditions, give each its own hue from
the spare colours (`colorlavender`, `colormint`, `coloryellow`, ...) and keep
it consistent within the figure. Red stays reserved for cost/loss/error and the
`hl` "follow this" highlight.

### Book-wide notation and conventions

«The conventions that the field disagrees on and the choice this book makes,
e.g. "t = 0 is noise, t = 1 is data; papers that use the opposite get a
'in their convention' note with the mapping t ↦ 1 − t". Symbols, index order,
tensor layouts, units.»

## 3. Chapter HTML fragment format

`«BOOK»/chapters/<cid>.html` contains exactly one `<section>`; no `<html>`,
`<head>`, `<style>` or `<script>`. The build adds navigation, figure numbering,
theme-switching images and maths rendering.

```html
<section class="chapter" id="w03" data-part="course" data-short="Dynamic OT">
  <header class="ch-head">
    <p class="ch-kicker">Session 3 · Mon Sep 28 · Lecture</p>
    <h2>A dynamic view on distribution morphing</h2>
    <p class="ch-thesis">One or two sentences: the single idea this chapter digs into, phrased as what the reader will be able to see.</p>
    <ul class="ch-refs">
      <li><a href="https://arxiv.org/abs/2210.02747">Lipman et al., Flow Matching for Generative Modeling (2023)</a></li>
    </ul>
  </header>

  <h3>Subsection heading</h3>
  <p>Prose. Inline math \( x_t = t\,x_1 + (1-t)\,x_0 \). Display:</p>
  <p class="eq">\[ \mathcal{L} = \mathbb{E}\,\| v_\theta(x_t,t) - (x_1-x_0) \|^2 \]</p>

  <figure class="fig" id="fig-w03-marginal">
    <img src="figs/w03-marginal.png" alt="Concise description of what is drawn">
    <figcaption><strong>Conditional paths cross; the marginal flow does not.</strong> Reading guide, 3–6 sentences, in the order the eye should move: start at…, then…, the takeaway is….</figcaption>
  </figure>

  <aside class="note"><p class="note-k">In practice</p><p>Short practical remark, pitfall or "what interviewers ask".</p></aside>

  <div class="takeaways">
    <h3>Take away</h3>
    <ul><li>Three to five crisp bullets.</li></ul>
  </div>
</section>
```

Rules:

- `ch-kicker` says where the chapter sits («e.g. `Session N · <date> ·
  Lecture` for Part I, `Toolkit · <area>` for Part II»).
- Maths: `\( \)` and `\[ \]` only, never `$`. Extra macros: `\R`, `\E`,
  `\KL`, and the role macros in the table above (use them on the key symbols
  of key equations, not everywhere). Otherwise standard LaTeX that MathJax
  supports. Escape `<`, `>`, `&` in prose as `&lt;`, `&gt;`, `&amp;`
  (inside maths write `\lt`, `\gt`).
- Allowed blocks: `h3`, `h4`, `p`, `p.eq`, `ul/ol`, `figure.fig`,
  `aside.note` (with `p.note-k` label: "In practice", "Pitfall",
  "Interview check", "Connection"), `div.takeaways`, a simple `table` inside
  `<div class="tbl">`, and `pre><code` for ≤15 lines of code where code is the
  clearest explanation. No inline styles, no other classes.
- Length: «900–1800» words per chapter plus figures. Write plainly and
  precisely: short sentences, active voice, no marketing, no em-dash asides.
  Explain *why* mechanisms work. Give concrete numbers.
- Cross-link other chapters with `<a href="#v05">UNet vs DiT</a>` using the ids
  in section 4. Cite with links you are confident are correct; if unsure of an
  arXiv id, link a Google Scholar search instead
  (`https://scholar.google.com/scholar?q=...`).
- Correctness matters more than anything. Double-check formulas, signs,
  shapes and attributions; verify specific claims with WebSearch/WebFetch. If a
  production-system detail is uncertain, say "e.g." or describe it generically
  rather than inventing specifics.

## 4. Chapter map (for cross-links)

«Every chapter id with a 2–6 word title, grouped by part.»

## 5. When done

Reply with: the files written, one line per figure stating its one idea (for
live figures also the interaction, and the test results), and anything you are
unsure about (facts you could not verify, illustrations that are not computed
results). Keep it short.
