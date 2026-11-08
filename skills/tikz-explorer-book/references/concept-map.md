# The concept map (home page)

The map is the explorer's front door: an Obsidian-style graph of the field's
core concepts and landmark works, so the reader sees the whole landscape and
how the branches connect before going deep into any chapter. It is an
overview. Each node says what an idea *is* and *where it sits*; how it works
belongs in the chapter that "Go deeper" links to.

Write `map/data.json` yourself (the orchestrator), after the chapter plan is
fixed and ideally while the authors are drawing, because it needs the whole
field in one head and must stay consistent. Run `scripts/check_book.py` to
validate it.

## Contents
1. Schema
2. Choosing families and nodes
3. Writing blurbs and relations
4. The tour
5. How the page uses it

## 1. Schema

```json
{
  "families": [{"id": "diff", "label": "Diffusion & score", "blurb": "one line", "dark": "#80B1D3", "light": "#3A7DB5"}],
  "nodes": [
    {"id": "core", "type": "hub", "fam": null, "label": "Noise → data", "blurb": "...", "deeper": ["w01"]},
    {"id": "fm", "type": "concept", "fam": "flow", "label": "Flow matching", "blurb": "...", "deeper": ["w03", "v01"]},
    {"id": "p_fm", "type": "paper", "fam": "flow", "label": "Flow Matching", "who": "Lipman et al.", "year": 2022,
     "url": "https://arxiv.org/abs/2210.02747", "blurb": "one line: what it showed"}
  ],
  "links": [["ddpm", "fm", "special case: Gaussian paths"], ["p_fm", "fm", "introduces"]],
  "tour": [{"title": "Diffusion is a flow", "text": "one paragraph", "nodes": ["pfode", "cnf", "fm", "rf"]}]
}
```

- `type`: exactly one `hub` (the single problem the field solves, pinned at
  the centre; any id works, but without a hub the map does not render), `concept` nodes (the map proper), `paper` nodes (landmark works:
  papers, books, talks, systems; shown as small rings when "Key works" is on,
  and listed in each concept's panel).
- `fam`: family id, or `null` for the hub. Family colours default to a
  10-colour palette in order; override with `dark`/`light` hex if a family
  should echo a colour role.
- `deeper`: chapter ids from `book.json`, so the panel can link into the book.
- `links`: `[source, target, relation]`, read as "source *relation* target".
  Paper-to-concept links use `introduces` (or `uses`).

## 2. Choosing families and nodes

Scale the map to the book. The numbers below are for a full course or field
(10+ chapters). For a small book (one topic, 2–5 chapters) aim for 2–4
families, 6–15 concepts, 3–8 key works and 3–5 tour steps, keeping the same
rules: one hub, every concept within three hops of it, every chapter reachable
from at least one node's "deeper".

- 6–10 families. Each is a branch a researcher would name ("Fast sampling",
  "Conditioning"), not a chapter list. Order them so neighbours on the ring are
  related; the layout places families on an ellipse, clockwise from the left
  via the top.
- 35–55 concepts. Enough to cover the field's vocabulary, few enough to read at
  overview zoom. Merge near-duplicates; one node per idea the reader must be
  able to name.
- 1–2 landmark works per concept, 40–60 in total: the papers "everyone in the
  field is expected to know". Prefer the paper that introduced the idea, plus
  the one that made it work at scale. Verify every URL/arXiv id; if unsure,
  use a Google Scholar search link. To verify, fetch
  `https://arxiv.org/abs/<id>` one at a time and compare the page `<title>`
  with the paper you mean; the arXiv export API rate-limits almost at once.
- Every node needs at least one link, and every concept should reach the hub
  within two or three hops. Cross-family links are where the "connect the dots"
  value is (e.g. OT → straight flows, GAN ↔ adversarial distillation); include
  them deliberately.

## 3. Writing blurbs and relations

- Concept blurb: 2–3 sentences. What it is, in plain words; why it matters or
  what it replaced; where it shows up now. No derivations.
- Work blurb: one line on what it showed.
- Relation labels: 2–6 words, a verb phrase that reads correctly from source
  to target: "is a special case of", "replaced at scale", "trained without
  simulation by", "computes couplings for". Avoid vague labels like
  "related to"; if you cannot name the relation, the link probably isn't
  worth drawing.

## 4. The tour

6–9 steps (3–5 for a small book) that tell the field's story in order, each a title of 2–4 words, one
paragraph (2–4 sentences) that connects the step's nodes, and 4–8 node ids.
Together the steps should cover most concepts. The tour is what makes the map
an explanation rather than a picture: write it as the narrative you would give
someone in five minutes at a whiteboard.

## 5. How the page uses it

`tools/build.py` inlines the data, renders the legend (family chips that focus
a branch), a search box, and a static index of every concept with its works
(this also serves readers without JavaScript). `map/map.js` runs a d3 force
layout anchored by family, hover-highlights neighbours, opens a panel on click
(blurb, relations, works with links, "Go deeper" chapter links) and zooms to
each tour step. Paper rings are hidden by default so the overview stays
readable. Labels collide if a family has too many long labels; shorten labels
before tuning forces.
