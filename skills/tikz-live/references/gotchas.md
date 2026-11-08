# Gotchas

**A live number shows the wrong glyphs or "is not a number slot".** The node must
contain exactly `\(\dlnum\)`: no prefix such as `\beta =`, and no `\textcolor`.
Put the prefix in its own static node and chain them with
`at (prefix.base east)` and `anchor=base west, inner sep=0` on both.

**A live slot "produced no glyphs".** A colour command inside the node
(`\aqua{...}`, `\textcolor`) overrode the ID colour. Use `text=coloraqua` on the
node instead.

**"glyph job page size differs".** Something moved the bounding box, usually the
long invisible `\dlnum` sample. Add `\useasboundingbox`; you need it anyway,
because the live drawing must fit inside the page.

**The overlay is offset or scaled wrong.** You used `scale=` or a shifted scope.
Set units with `x=`/`y=` on the tikzpicture. Inside scopes, export nodes and
refer to them by name instead of using raw coordinates.

**Numbers in cells sit too high or too low.** Place the live node with
`anchor=mid west` at the cell centre (mid = baseline + 0.5ex, which centres
digits), then `d.number(id, v, {at: cell})`.

**Negative numbers overflow narrow cells.** Use `narrowMinus: true` and
`leadingZero: false`, or give the cell more room.

**The overlay covers the scaffold's outlines** (heatmap fills over cell borders).
Draw the fill with its stroke: `d.rect(sw, ne, {fill: ..., color: "aqua", width: "thick"})`.

**Curves bend the wrong way.** `bend` follows TikZ: positive bends to the *left
of the direction of travel*. Travelling downwards, left is east. Flip the sign.

**Paths run through readouts or the equation.** Clip the dynamic paths with
`d.group({clip: [[x0, y0], [x1, y1]]}, d => ...)`, and keep readouts in a corner
that the paths rarely reach. Check the extreme snapshots.

**Hover only reacts on some rows.** Hotspots are exported boxes; a row needs a
`fit` node with `export`, not just its cells. Test `hotspots` against the
exported names the build prints.

**Something isn't in the PNG.** Snapshot PNGs are the scaffold PDF with the
overlay stamped on top, so the scaffold (a TeX `\clip` included) is exact. The
overlay layer goes through MuPDF's SVG reader, which skips `stroke-dasharray`
and SVG `clip-path` (never clip with `d.raw`; `d.group({clip})` clips
geometrically and is safe), and PNGs show no hover cursor or focus rings.
Check those in a browser.

**State changes but the picture doesn't (hidden tab).** Fixed: the runtime draws
synchronously when the tab is hidden, since a hidden tab gets no animation
frames. Play still pauses there.

**The figure opens empty because nothing is hovered.** Set `initial: {hover: ...}`
and `stickyHover: true`.

**A number shows as "3.00".** That was the old default; now trailing zeros are
dropped unless you pass `digits` or `trim: false`.

**Matrix cells.** `export` works on `\matrix` cells (exports are written at the
end of the picture, after the matrix has placed them). The cell name is
`<matrix>-<row>-<col>`.

**TeX text is cut off at the page edge.** The build warns ("TeX text runs past
the page"). Enlarge `\useasboundingbox` or move the text.

**pdflatex is slow.** Each build runs it twice (about 2–5 s each). After a change
to the `.js` only, use `--no-tex`.

**Node treats the spec as an ES module.** The spec is run in a vm context, so `import`
and `export` are not available. Write a plain script that calls `DLLive.figure`.
