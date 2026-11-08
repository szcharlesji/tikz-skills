# TikZ and pgfplots gotchas

Problems actually hit while building the example figures, and their fixes.

## Compile errors

| Symptom | Cause | Fix |
|---|---|---|
| `File 'standalone.cls' not found` / `pgfplots.sty` | BasicTeX/minimal installs omit them | `tlmgr install standalone pgfplots` (or `tlmgr init-usertree && tlmgr --usermode install ...` without admin rights). Ask the user first. |
| `Environment groupplot undefined` | a stale `dlviz.sty` next to the figure | `render.py` refreshes the copy when the skill's is newer; otherwise delete the local copy |
| `Arc expected` on `\node[vx] at (1,0);` | styles with `node contents` (`vx`, `vh`, `Pred`, `cC`...) end the node at the option list | put the position first: `\node at (1,0) [vx];` or `\node[vx, at={(1,0)}];` |
| `Cannot parse this coordinate` inside `cm={\macro}` | `cm` needs literal numbers | write `cm={1.2,0.6,-0.4,0.9,(0,0)}` in place |
| `Missing number` in `minimum size=\x` or `fill=colorX!\v!dlbg` | `\v` is a decimal like `.55` | convert first: `\pgfmathsetmacro\pct{int(100*\v)}` |
| `\pi` breaks later maths | `\def\pi{...}` (or `\i`, `\j` reused globally) clobbered a TeX command | use names like `\oi`, `\hlrow`; `\foreach` variables are local, `\def` at picture level is not |
| `Undefined control sequence \softmax` in a user's document | they did not load `dlviz` | `\DeclareMathOperator{\softmax}{softmax}` in their preamble |
| `Dimension too large` | pgfmath overflow on huge or tiny numbers (|x| > 16383) | rescale in Python before pasting, or use `fpu` in pgfplots |
| `\foreach` inside `axis` draws nothing or errors | pgfplots defers axis content | use `\pgfplotsinvokeforeach{1,...,5}{ ... #1 ... }`, or loop outside the axis using `(axis cs:...)` names saved with `\coordinate` |
| a ✗ or marker on a dashed path comes out dashed | it inherits the path style | give it its own `\draw[solid, ...]` |
| `contour gnuplot` fails | needs gnuplot and `-shell-escape` | compute contours in Python, or use analytic level sets |
| `I do not know the key '/pgfplots/bar width'` in a `groupplot` | inside `group style` options the key lives in the pgf tree | write `/pgf/bar width=4pt` |

`render.py` prints only the first error. Fix it and recompile; later errors are
often consequences of the first.

## Layout traps

- **Annotations clipped in pgfplots.** Everything inside `axis` is clipped to
  the axis box. Keep notes well inside, use two short lines with
  `align=center`, or set `clip=false` on that axis. Notes outside the axes go
  after `\end{axis}` and refer to `(name.south)` etc.
- **Text crossing lines.** Add `knockout` to the note (fills it with the page
  colour), move it, or reroute the line. Never leave a line through text.
- **`knockout` erases data too.** It paints the page colour behind the note,
  so a knocked-out note drawn after a curve (inside a pgfplots axis, after
  `\addplot`) cuts a hole in the curve. Move the note off the data, or draw
  it before the data so the curve stays on top.
- **Arrows through labels.** A highlight (`hl`) on both ends is often enough;
  the connecting arrow can go.
- **Piecewise functions sampled.** `samples=2` on `max(0,x)` draws a straight
  line through the kink. Use `coordinates {(-4.5,0) (0,0) (1.5,1.5)}`.
- **`axis equal` fighting `ymin/ymax`.** `axis equal` overrides the limits and
  makes tall, empty plots. Prefer explicit `width`/`height` and limits, or
  `unit vector ratio`.
- **Nodes placed with `right=of` measure from borders**, so neurons (7.5 mm) and
  bullets (15 mm) end up evenly spaced. Do not mix them with `at (x,y)`
  placement in the same row.
- **`fit` boxes** take `inner sep` and you can't set `minimum height` with
  `fit` reliably for asymmetric content; use `inner xsep`/`inner ysep` and a
  `yshift`.
- **Opacity stacking.** Overlapping `opacity` fills darken unpredictably and
  look muddy on dark backgrounds. Prefer colour mixes (`colorX!25!dlbg`).
- **Light text on light fill.** For heatmap cells above ~40% tint switch the
  text to `dlbg`: `text=\ifnum\pct>40 dlbg\else dlfg\fi`.
- **Fonts in PNGs look thin.** Render at `--dpi 220` or more for slides;
  the PDF is vector and always crisp.
- **A shifted `at=` on an axis is ignored.** `at={([yshift=-36mm]p1.south west)}`
  as an axis option drops the shift silently. Keep `at={(p1.south west)}` and
  give the axis its own `yshift=-36mm` key.
- **Bars on a log axis grow down from the top.** Set `log origin y=infty` as an
  *axis* option (on the `\addplot` it does nothing), so bars rise from the bottom.
- **Two `ybar` plots in one axis sit side by side.** pgfplots groups them
  automatically. To overlay a reference outline on bars, draw it as a non-bar
  plot with `const plot mark mid`.

## Handy idioms

```latex
% list-of-lists matrix with named cells
\foreach \row [count=\i] in {{.5,.5},{.1,.9}}
  \foreach \v [count=\j] in \row
    \node[cell=coloraqua] (M-\i-\j) at (\j*6mm, -\i*6mm) {\v};

% highlight a whole row of named cells
\draw[hl] (M-2-1.north west) rectangle (M-2-2.south east);

% brace with a note
\draw[brace] (M-1-2.north east) -- (M-2-2.south east)
  node[midway, right=5pt, annot] {sums to 1};

% point between two nodes, offset
\coordinate (mid) at ($(a)!0.5!(b) + (0,5mm)$);

% "x N" repeated block
\node[group, fit=(blk1)(blk3), label={[annot]east:\(\times N\)}] {};

% paste Python numbers
\draw[colororange, thick] plot coordinates {(-4.00,1.50) (-3.28,-1.20) ...};
```
