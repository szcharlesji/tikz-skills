---
name: tikz-dl-visualizer
description: Explain a deep-learning concept with a beautiful, intuition-first static TikZ/pgfplots figure (compiled to PDF and PNG) plus a short walkthrough of how to read it, aimed at intermediate deep-learning students. Made for slides and decks (PowerPoint, Keynote, Beamer), papers, theses, handouts and lecture-note PDFs. Uses a consistent visual language (colour = role, Canziani NYU-DL book style) and standard DL notation. Use this whenever someone asks to visualize, illustrate, diagram, draw, sketch or "show me" any ML/DL idea (attention, convolution, backprop, normalization, residuals, RNN/LSTM, VAEs, diffusion, GANs, contrastive learning, optimizers, loss landscapes, activations, embeddings, energy-based models...), asks for a TikZ or LaTeX figure of a neural network or architecture, wants a figure for lecture notes, slides, homework, a thesis or a paper, or says "help me understand X visually", even if they never say "TikZ". For a figure the reader should drag, slide or hover, use tikz-live; for a whole illustrated web book of a course or field, use tikz-explorer-book (which uses both).
---

# TikZ deep-learning visualizer

You are drawing for a student who already knows the basics (MLPs, backprop,
CNNs, what a transformer is) and wants the *why*. A good figure here is not a
decorated diagram of boxes; it makes one idea obvious at a glance and then rewards
a second look. The style follows Alfredo Canziani's NYU Deep Learning book: a dark
grey page, ColorBrewer Set3 pastels, and colour that always means the same thing.

Everything you need is bundled:

- `assets/dlviz.sty`: palette (dark and light), notation macros, node styles,
  pgfplots looks, helpers. Always build on it rather than restyling from scratch;
  that is what keeps every figure in one visual language.
- `assets/examples/*.tex` (with a `.png` preview of each): six compiled,
  reviewed figures, one per archetype. Look at the PNG to see the target quality.
  Start from the closest one.
- `scripts/render.py`: compiles to PDF and PNG and prints only the first error.
- `references/visual-language.md`: colour roles, element vocabulary, notation,
  typography and layout rules. Read it before your first figure in a session.
- `references/archetypes.md`: which picture fits which concept, plus a table of
  DL facts that figures commonly get wrong. Read the row for your concept.
- `references/tikz-gotchas.md`: compile errors and layout traps we hit, with fixes.
  Read it when something does not compile or looks off.

## Workflow

### 1. Find the one idea

Before touching TikZ, write down in one sentence the insight the figure must
deliver, phrased as something the student will *see*, for example:

- "Each output row of attention is a weighted average of value rows, and the
  weights are a row of a softmaxed score matrix."
- "Momentum cancels the oscillating gradient component and accumulates the
  consistent one."
- "A residual block only has to learn the correction F(x), because x is passed
  through untouched."

If you cannot write that sentence, you do not yet know what to draw. Ask
yourself what misconception the student most likely has and aim the figure at
it. If the concept is broad (e.g. "transformers"), pick the single most
illuminating slice and say so; offer a follow-up figure for the rest rather than
cramming everything into one.

### 2. Pick the archetype

Open `references/archetypes.md` and choose the visual form that makes the
sentence visible. The main ones:

| Archetype | Shows | Example file |
|---|---|---|
| pipeline / computation graph | how data flows, what feeds what | `autoencoder.tex` |
| matrix / heatmap layout | tensor shapes and products, weights | `attention.tex` |
| grid + receptive field | local, sliding, shared operations | `convolution.tex` |
| parameter-space geometry | optimization paths, loss contours | `momentum.tex` |
| small multiples of plots | comparing functions or settings | `activations.tex` |
| before/after space warp | what a layer does to input space | `linear-map.tex` |

Combining two archetypes is fine (a pipeline with a small heatmap inset), but one
should dominate.

### 3. Make it concrete

Abstraction is the enemy of intuition. Use small, specific sizes (4 tokens,
d_k = 3, a 5x5 input, 2-D parameters) and say what they stand for. Real
numbers beat placeholders: weights that sum to 1, a convolution whose output you
can verify, a trajectory that is actually what the optimizer does.

**Compute numbers in Python, never by hand or in your head.** Run a short script
(numpy via `uv run --with numpy python -` or plain Python), then paste the
coordinates or values into the `.tex`. Leave a comment saying how they were
produced. Hand-made "illustrative" numbers are where wrong figures come from: a
softmax row that sums to 1.1, a conv output that does not match its input.

### 4. Write the figure

Create `<concept>.tex` in the output folder (the user's folder if they named
one, otherwise the current working directory) starting from:

```latex
% Caption: <2-3 sentences: what to look at and what it shows>
\documentclass[tikz,border=8pt]{standalone}
\usepackage[dark]{dlviz}   % [light] for white papers / slides
\begin{document}
\begin{tikzpicture}
  ...
\end{tikzpicture}
\end{document}
```

Pick the theme from where the figure will live: dark (the book look) for
slides, screens and anything the user says should match the book; light for
paper-like destinations (papers, theses, lecture-note PDFs, homework, printing)
or when asked. If nothing hints either way, use dark and mention `[light]`. The
colour roles hold in both themes, so switching is one word.

Principles that matter most (details in `references/visual-language.md`):

- **Colour = role, consistently.** Input x pink, hidden h green, prediction ỹ
  violet, target y blue, latent z orange, cost/loss/energy red, encoder lavender,
  decoder aqua, predictor yellow, parameters gold. Use the same colour for a
  symbol in the drawing, in the labels and in the equation (`\pink{\vx}`). This
  lets the eye link picture and maths without reading. At most ~5 hues per
  figure; everything structural is white/grey.
- **Contrast needs two hues.** When the figure compares two conditions (plain vs
  residual, SGD vs momentum, BatchNorm vs LayerNorm), give each its own hue and
  use those hues for that condition's curves, labels and highlights throughout.
  Do not draw both in red just because both are gradients; red then marks the
  shared thing (the loss, the backward direction), and the comparison stays
  readable at a glance.
- **Make magnitude visible.** If a quantity grows or shrinks (gradient norm,
  attention weight, variance), encode it in the drawing itself, not only in a
  printed number: line width that thins step by step, fill tint, arrow length,
  dot size. Correspondence also deserves ink: thin lines from each sample to
  where it lands show a transformation better than two separate clouds.
- **Show the maths, colour-coded.** Put the defining equation in the figure,
  usually underneath, with each term coloured like its visual counterpart.
- **Shapes on everything.** Label tensors with their shape in the muted `dim`
  style (`\(\R^{n\times d_k}\)`). Shape bookkeeping is half of understanding a DL
  operation.
- **Follow one example through.** Highlight one row, one patch or one step
  (`hl` style, red outline) everywhere it appears, so the student can trace a
  single computation end-to-end.
- **Annotate sparingly and in place.** Two or three short italic notes (`annot`)
  with thin leader lines, next to what they explain. Direct labels instead of a
  legend box. No overall title (the caption does that), but multi-panel figures
  get short panel labels like "(a) plain: \(\vx_l = F_l(\vx_{l-1})\)" in `annot`
  style, with clear space above each panel.
- **Least ink.** No shadows, gradients, 3-D for its own sake or decorative icons.
  Fills are light tints of the stroke colour (`cell=colorX` does this).
- **Standard notation.** Bold lowercase vectors, bold uppercase matrices, plain
  scalars; use the macros (`\vx`, `\mW`, `\vytld`, `\softmax`). Row-vs-column
  conventions must match the equation you print (attention uses row-per-token
  Q, K, V as in Vaswani et al.).

### 5. Compile and look at it

```bash
python <skill-dir>/scripts/render.py path/to/concept.tex
```

It copies `dlviz.sty` next to the figure so the folder can be recompiled
anywhere, then writes `concept.pdf` and `concept.png`. If compilation fails it
prints the first error; check `references/tikz-gotchas.md`. If a package is
missing it prints the `tlmgr` command; tell the user rather than running
installs on their machine without asking.

**Then open the PNG and critique it like a reviewer.** Compiling is not done;
every figure in `assets/examples` needed at least one round of fixes after
looking. Check:

1. Does anything overlap or touch: text on lines, arrows through labels, text
   touching a node border, labels clipped at an axis or panel edge, one panel's
   notes crowding the next panel's label? Zoom in on dense areas (crop the PNG
   with `magick in.png -crop WxH+X+Y out.png`) rather than trusting a thumbnail.
2. Can you see the one idea within three seconds? What does the eye land on
   first? Is that the right thing?
3. Is every colour doing a job, and is each role coloured the same everywhere?
4. Is every number, shape and formula correct (see the facts table in
   `references/archetypes.md`)?
5. Is the spacing even and the alignment deliberate?

Fix and recompile until the answers are all yes. Two or three iterations is
normal.

### 6. Deliver

Give the user:

1. The PNG, shown inline if you can display or send files, plus paths to the
   `.tex`, `.pdf` and `dlviz.sty`.
2. A **reading guide**: 4-8 sentences that walk the eye through the figure in
   the order it should be read ("Start at the highlighted row of Q..."), connect
   each visual element to the maths, and end with the takeaway. Write for an
   intermediate student: no re-explaining what a neuron is, but do explain why
   the mechanism works.
3. One line on how to adapt it: switch to `[light]`, change sizes, or a natural
   follow-up figure (e.g. "multi-head version next?").

Keep the `% Caption:` comment at the top of the `.tex` in sync with the
figure; it is the caption the user will paste under it in their document.

## Sibling skills

This skill makes **static** figures: one PDF/PNG per idea, for slides, papers
and print. Two siblings share the same `dlviz.sty` and visual language:

- **tikz-live**: the same kind of figure made interactive (drag, slide, hover,
  play) as a self-contained web page. Use it when the reader should *change*
  something and watch the mechanism respond, or when the user asks for an
  interactive, explorable or animated-in-the-browser figure.
- **tikz-explorer-book**: a whole web book of a course or field, with a
  concept map and chapters of figures; it uses this skill for static figures
  and tikz-live for the live ones.

## When the request is unusual

- **The user's own LaTeX document or preamble.** Match their notation and
  colours if they have them; you can still `\input` the styles from `dlviz.sty`
  or copy only the parts they need. Do not override their page colour.
- **Slides (Beamer).** Produce the standalone figure and show
  `\includegraphics` usage; for step-by-step builds, put `\only<n>` /
  `\visible<n>` on layers, or make several standalone files (step-1, step-2...).
- **Animation or a process over time.** For print and slides, prefer small
  multiples (t = 0, 1, 2, ..., T) in one figure; a sequence of panels shows
  the trend that an animation hides. If it will be read on screen and the
  reader should step or scrub through it, use tikz-live instead.
- **PowerPoint / Keynote.** Insert the PNG (rendered at 200 dpi, sharp at full
  slide width) or the PDF; for a white slide template use `[light]`.
- **A paper figure.** Use `[light]`, drop the in-figure equation if the paper
  states it, and keep the fonts the paper's (no font packages are loaded by
  `dlviz`, so the document font is used).
- **3-D surfaces.** Use pgfplots `\addplot3[surf]` with `view={...}` and a muted
  colormap (`colormap name=dlheat`), and ask whether a contour plot would explain
  it better. It usually does.
