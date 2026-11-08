# Visual language

The vocabulary in `assets/dlviz.sty`, and the reasons behind it. The style is
taken from Alfredo Canziani's NYU Deep Learning book (Appendix A "TikZ"), which
is itself shaped by Edward Tufte: maximise data ink, let text and graphics merge,
and annotate in place.

## Contents
1. Colour roles
2. Element vocabulary (node and edge styles)
3. Notation macros
4. Typography and annotation
5. Layout
6. Light vs dark

## 1. Colour roles

Colour is a semantic channel, not decoration. Once a student learns that pink
means "input", every later figure is cheaper to read. Keep these assignments
across all figures:

| Role | Colour name | Macro | Dark hex |
|---|---|---|---|
| input x | `colorpink` | `\pink{}` | FCCDE5 |
| hidden / representation h | `colorgreen` | `\green{}` | B3DE69 |
| prediction ỹ, reconstruction x̂ | `colorviolet` | `\violet{}` | BC80BD |
| target y | `colorblue` | `\blue{}` | 80B1D3 |
| latent z | `colororange` | `\orange{}` | FDB462 |
| cost, loss, energy, gradient signal | `colorred` | `\red{}` | FB8072 |
| encoder | `colorlavender` | `\lavender{}` | BEBADA |
| decoder | `coloraqua` | `\aqua{}` | 8DD3C7 |
| predictor | `coloryellow` | `\yellow{}` | FFFFB3 |
| parameters / kernels W | `colorgold` | `\gold{}` | FFED6F |
| spare | `colormint`, `colorgray` | `\mint{}`, `\gray{}` | CCEBC5, D9D9D9 |
| structure (axes, grids, arrows) | `dlfg`, `dlfaint`, `dlgrid` | `\muted{}` | |

Concept-specific roles (queries/keys/values, two optimizers, classes) borrow
from the palette. Pick hues that are not already playing a role in the same
figure, and keep the assignment consistent if you make a series. The bundled
attention figure uses Q blue, K orange, V green and the weights aqua.

Red is reserved for the cost side of things: loss, energy, the gradient that
flows back from it, and the highlight (`hl`) that says "look here". Do not use
it for an ordinary variable.

Limit each figure to about five hues. If you need more categories, the figure is
probably trying to say too much.

Fills: never a saturated fill behind text. `cell=colorX` and
`block=colorX` fill with an 18% / 12% tint of the stroke so the outline carries
the colour. For value-encoding (heatmaps) use `colorX!<pct>!dlbg`, where pct
is the value as a percentage, and switch the text to `dlbg` above about 40% so it
stays legible.

## 2. Element vocabulary

From the book (Appendix A.2):

| Style | Shape | Meaning |
|---|---|---|
| `neuron` and `vx`, `vh`, `vytld`, `vy`, `vz` | circle, 7.5 mm | a variable (vector); the preset ones carry their symbol |
| `bullet`, `Pred`, `Dec`, `Enc`, `module=<colour>` | rectangle with a rounded east side | a deterministic function; the round side points where data goes |
| `cost`, `cC` | red square | a scalar cost |
| `system energy` | red dashed box | everything that defines an energy F |
| `observed=<colour>` | shaded fill on a neuron | an observed variable, as opposed to a latent one |

Added for broader DL figures:

| Style | Use |
|---|---|
| `block=<colour>` | a layer in an architecture diagram (Linear, LayerNorm, MHA) |
| `op` | small circle for ⊕, ⊗, σ, + junctions |
| `group` | dashed rounded box grouping a repeated block ("× N") |
| `flow` | forward-pass arrow |
| `grad` | backward-pass / gradient arrow (red, dashed) |
| `skip` | residual / skip connection (faint, rounded corners) |
| `cell=<colour>` | one entry of a vector, matrix or feature map |
| `\dlvec{(x,y)}{name}{n}{colour}{v or h}` | a vector drawn as n cells named name-1..n |
| `\dlcuboid{(x,y)}{w}{h}{depth}{colour}{label}` | a 3-D feature-map block for CNN shape diagrams |
| `dim` | tensor-shape label, muted and small |
| `annot` + `leader` | italic note with a thin pointer line |
| `knockout` | add to an `annot` node so it masks lines behind it |
| `brace` | curly brace for "this span is ..." |
| `hl=<colour>` | thick outline that highlights the element being followed |

Pgfplots presets: `school axis` (centred axes and a grid, as in the book's
activation plots), `dl axis` (left/bottom spines only, for data), `curve`
(1.2 pt smooth line), the colormap `dlheat` (bg → blue → aqua → yellow).

## 3. Notation

Standard deep-learning notation (Goodfellow et al., and the NYU course):

- scalars italic (`s`, `\eta`), vectors bold lowercase (`\vx`, `\vh`, `\vz`),
  matrices bold uppercase (`\mW`, `\mQ`), sets and spaces blackboard (`\R`).
- `\vytld` = ỹ (prediction), `\vxhat` = x̂ (reconstruction), `\vtheta` for all
  parameters, `\cL` loss, `\cC` cost, `\cF` free energy.
- Index order: `h_{ij}` row i, column j; time as superscript or a `t` subscript,
  but be consistent within a figure.
- Batches: PyTorch layout `(B, C, H, W)` for images, `(B, T, d)` for sequences.
  When shapes matter, write them.
- Activation `(\cdot)^+` for ReLU, as in the book; `\sigma` for the logistic
  sigmoid; `\softmax` is defined as an operator.

## 4. Typography and annotation

- Math in the figure is real LaTeX math, so the equation in the figure matches
  the one in the text.
- Hierarchy through size and tint, not boldness: main labels `\normalsize`
  white; shapes and axis words `dim` (scriptsize, muted); notes `annot`
  (footnotesize italic, muted, or tinted with the colour of what they explain).
- Keep each annotation to 3-8 words, on one or two lines. If it needs a
  paragraph, it belongs in the reading guide.
- Prefer direct labels at the end of a curve or next to a block over a legend.
- Coloured words in a note (`\red{shaded}`) act as an inline legend.

## 5. Layout

- Read left to right (data flow) or top to bottom (time, depth). Arrows go with
  the reading direction, except gradients, which go backwards and are dashed red.
- Lay out matrix products so the shapes line up: for C = AB, put A to the left of
  C and B above it. The reader can then see that the inner dimensions match.
- Put a grid of cells on a spacing that suits it (`x=6mm, y=6mm`) and address
  cells by name (`A-3-2`), not raw coordinates; labels and highlights then stay
  attached when you move things.
- Use `node distance=7.5mm` and `right=of` for pipelines so spacing is uniform.
- Leave breathing room: `border=8pt` on the page, at least 3 mm between
  unrelated elements.
- Panels in a sequence share their axes and scale. That is what makes them
  comparable.

## 6. Light vs dark

`\usepackage[dark]{dlviz}` gives the book look: `#404040` page, white text, Set3
pastels. `[light]` gives a white page with darker versions of the same hues
(Set3 yellow is invisible on white), so every role keeps its meaning. Use light
for papers, printouts and white slide templates. Never hard-code `white` or
`black`; use `dlfg`/`dlbg` so a figure survives the switch.
