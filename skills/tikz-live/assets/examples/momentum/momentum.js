// Live part of momentum.tex: heavy-ball momentum vs plain GD on
// L(w) = (w1^2 + 10 w2^2) / 2, 30 steps from a draggable start point.
const LAM = [1, 10], T = 30;
function run(beta, eta, w0) {          // v = beta v + grad, w -= eta v
  let w = w0.slice(), v = [0, 0];
  const P = [w.slice()];
  for (let t = 0; t < T; t++) {
    v = [beta * v[0] + LAM[0] * w[0], beta * v[1] + LAM[1] * w[1]];
    w = [w[0] - eta * v[0], w[1] - eta * v[1]];
    P.push(w.slice());
  }
  return P;
}
const loss = (w) => 0.5 * (LAM[0] * w[0] ** 2 + LAM[1] * w[1] ** 2);

DLLive.figure({
  title: "Momentum on an ill-conditioned bowl",
  caption: "Drag the white dot <i>w</i>₀ or change β and η. Aqua: momentum; faint orange: plain gradient descent from the same start. ▶ Play replays the 30 steps.",
  params: {
    beta: { label: "β", min: 0, max: 0.99, step: 0.01, value: 0.6 },
    eta: { label: "η", min: 0.01, max: 0.2, step: 0.01, value: 0.15 },
    t: { min: 0, max: T, step: 1, value: T, hidden: true },
  },
  handles: { w0: { value: [-4, 1.5], min: [-5.2, -1.85], max: [5.2, 1.85], label: "start point w0" } },
  play: { param: "t", ms: 110 },
  compute: (s) => ({ mom: run(s.beta, s.eta, s.w0), gd: run(0, s.eta, s.w0) }),
  draw(d, s, c) {
    d.group({ clip: [[-5.6, -2.0], [5.75, 2.35]] }, (d) => {
      d.path(c.gd.slice(0, s.t + 1), { color: "orange!55!bg", width: "thick" });
      d.path(c.mom.slice(0, s.t + 1), { color: "aqua", width: "thick", dots: true });
      if (s.t < T) d.circle(c.mom[s.t], 2.6, { color: "aqua" });
    });
    d.number("beta", s.beta, { digits: 2 });
    d.number("eta", s.eta, { digits: 2 });
    d.number("Lmom", loss(c.mom[T]));
    d.number("Lgd", loss(c.gd[T]));
    d.label("w0lab", { from: [-4, 1.5], to: s.w0 });
  },
  snapshots: [
    { name: "beta0", beta: 0 },
    { name: "overshoot", beta: 0.95, w0: [3, -1.2] },
    { name: "playing", t: 8 },
  ],
  tests: [{
    name: "matches numpy (momentum_data.py) at beta=0.4",
    state: { beta: 0.4 },
    check: (c) => Math.abs(c.mom[T][0] - 1.0364305933121495e-05) < 1e-15 || `w30 = ${c.mom[T]}`,
  }],
});
