// Live part of attention.tex: A = softmax(Q K^T / (tau sqrt(d_k))), output A V.
// Q, K, V are the values printed in the scaffold (one decimal).
const Q = [[2.0, 0.8, 0.0], [0.4, 2.2, 0.3], [0.0, 2.8, 0.4], [0.5, 0.5, 0.6]];
const K = [[1.2, 0.1, 0.2], [0.3, 1.4, 0.1], [0.0, 0.4, 1.3], [0.4, 0.3, 0.2]];
const V = [[0.9, 0.1, -0.2], [-0.3, 1.0, 0.4], [0.2, -0.5, 0.8], [0.0, 0.2, 0.1]];
const N = 4, DK = 3;
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
function attention(tau) {
  const A = Q.map((q) => {
    const z = K.map((k) => dot(q, k) / (tau * Math.sqrt(DK))), m = Math.max(...z);
    const e = z.map((x) => Math.exp(x - m)), sum = e.reduce((a, b) => a + b);
    return e.map((x) => x / sum);
  });
  const O = A.map((a) => V[0].map((_, c) => a.reduce((s, w, j) => s + w * V[j][c], 0)));
  return { A, O };
}

DLLive.figure({
  title: "Attention, one query at a time",
  caption: "Hover (or tap) a token to follow its query: its row of <b>A</b> holds the weights, and its output row is that weighted average of the rows of <b>V</b> (curve width = weight). Slide τ: small τ sharpens softmax towards argmax, large τ flattens it towards a plain average.",
  params: { tau: { label: "τ", min: 0.2, max: 4, step: 0.05, value: 1 } },
  hotspots: /^(Qrow|Arow|Orow)-\d$/,
  compute: (s) => attention(s.tau),
  draw(d, s, { A, O }) {
    const sel = s.hover ? +s.hover.split("-")[1] : null;
    // A as a heatmap; text flips to the page colour on dark-enough cells
    for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) {
      const w = A[i - 1][j - 1], pct = Math.round(100 * w);
      d.rect(`A-${i}-${j}.south west`, `A-${i}-${j}.north east`, { fill: `aqua!${pct}!bg`, color: "aqua", width: "thick" });
      d.number(`a-${i}-${j}`, w, { digits: 2, leadingZero: false, at: `A-${i}-${j}`, color: pct > 40 ? "bg" : "fg" });
    }
    for (let i = 1; i <= N; i++) for (let j = 1; j <= 3; j++)
      d.number(`o-${i}-${j}`, O[i - 1][j - 1], { digits: 2, leadingZero: false, narrowMinus: true, at: `O-${i}-${j}` });
    d.number("tau", s.tau, { digits: 2 });
    if (!sel) return;
    // follow one query: dim the other rows, outline this one everywhere
    const others = [1, 2, 3, 4].filter((i) => i !== sel);
    d.shade(others.flatMap((i) => [`Qrow-${i}`, `Arow-${i}`, `Orow-${i}`]), { opacity: 0.55 });
    for (const r of ["Qrow", "Arow", "Orow"]) d.hl(`${r}-${sel}`);
    // each V row feeds the output row with width proportional to its weight
    for (let j = 1; j <= N; j++) {
      const w = A[sel - 1][j - 1];
      d.shade(`Vrow-${j}`, { opacity: 0.7 * (1 - w) });
      d.line(`Vrow-${j}.west`, `Orow-${sel}.west`, { bend: -40, color: "aqua", width: 0.3 + 3.2 * w, opacity: 0.85 });
    }
  },
  snapshots: [
    { name: "hover-sat", hover: "Qrow-3" },
    { name: "sharp", tau: 0.3, hover: "Qrow-3" },
    { name: "flat", tau: 4 },
  ],
  tests: [
    { name: "rows of A sum to 1", check: ({ A }) => A.every((r) => Math.abs(r.reduce((a, b) => a + b) - 1) < 1e-12) || "row sum" },
    { name: "matches numpy at tau=1 (sat->cat = 0.6410)", check: ({ A }) => Math.abs(A[2][1] - 0.641) < 5e-5 || `A[sat][cat] = ${A[2][1]}` },
  ],
});
