/* dllive.js: runtime for "TikZ scaffold + live overlay" figures.
 *
 * The scaffold (everything static) is compiled by pdflatex and inlined as SVG.
 * A figure spec (figure.js) describes the dynamic part: parameters, draggable
 * handles, hover hotspots, a pure compute(state) and a draw(d, state, c) that
 * uses the TikZ-like drawing API below. Coordinates in draw() are the
 * tikzpicture's own units, so the overlay lines up with the TeX drawing.
 *
 * The same render() runs in the browser (mount) and in node (build snapshots),
 * so it never touches the DOM.
 */
(function (root) {
  "use strict";

  // ---- palette: identical to dlviz.sty ---------------------------------------
  const PALETTES = {
    dark: { bg: "#404040", fg: "#ffffff", muted: "#a6a6a6",
      aqua: "#8dd3c7", yellow: "#ffffb3", lavender: "#bebada", red: "#fb8072",
      blue: "#80b1d3", orange: "#fdb462", green: "#b3de69", pink: "#fccde5",
      gray: "#d9d9d9", violet: "#bc80bd", mint: "#ccebc5", gold: "#ffed6f" },
    light: { bg: "#ffffff", fg: "#1f1f1f", muted: "#8a8a8a",
      aqua: "#2a9d8f", yellow: "#c9a100", lavender: "#7468b0", red: "#e0533f",
      blue: "#3a7db5", orange: "#e8862a", green: "#5e9a1e", pink: "#d45d99",
      gray: "#7f7f7f", violet: "#944a95", mint: "#4da05a", gold: "#b58900" },
  };
  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgb2hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, p) => rgb2hex(hex2rgb(a).map((v, i) => (v * p + hex2rgb(b)[i] * (100 - p)) / 100));
  function makePalette(theme) {
    const P = Object.assign({}, PALETTES[theme] || PALETTES.dark);
    P.grid = mix(P.fg, P.bg, 22);   // dlgrid  = dlfg!22!dlbg
    P.faint = mix(P.fg, P.bg, 45);  // dlfaint = dlfg!45!dlbg
    P.white = "#ffffff"; P.black = "#000000";
    return P;
  }
  // "aqua", "#8dd3c7", "orange!55!bg" (TikZ mix), "red!40" (TikZ: with white)
  function colorOf(P, c) {
    if (c == null) return P.fg;
    if (c[0] === "#") return c;
    const parts = String(c).split("!");
    const base = (n) => {
      const k = n.replace(/^(dl|color)/, "");
      if (!(k in P)) throw new Error(`unknown colour "${n}" (use a dlviz name like aqua, red, fg, muted, faint, or #rrggbb)`);
      return P[k];
    };
    let out = base(parts[0]);
    for (let i = 1; i < parts.length; i += 2) out = mix(out, parts[i + 1] ? base(parts[i + 1]) : P.white, +parts[i]);
    return out;
  }

  // TikZ line widths in pt
  const WIDTHS = { "ultra thin": 0.1, "very thin": 0.2, thin: 0.4, semithick: 0.6,
    thick: 0.8, "very thick": 1.2, "ultra thick": 1.6 };
  const widthOf = (w, dflt) => (w == null ? dflt : typeof w === "number" ? w : WIDTHS[w] ?? dflt);

  // ---- coordinate map: TikZ units / canvas pt -> SVG viewBox units -------------
  function makeMap(frame) {
    const { sw, ne, origin: o, x: ex, y: ey, border: [bx, by], k } = frame;
    const det = ex[0] * ey[1] - ex[1] * ey[0];
    const ptX = (px) => (px - sw[0] + bx) * k, ptY = (py) => (ne[1] - py + by) * k;
    return {
      k,
      pt: (p) => [ptX(p[0]), ptY(p[1])],                         // canvas pt -> vb
      xy: (p) => [ptX(o[0] + p[0] * ex[0] + p[1] * ey[0]),      // TikZ units -> vb
        ptY(o[1] + p[0] * ex[1] + p[1] * ey[1])],
      inv: (X, Y) => {                                         // vb -> TikZ units
        const px = X / k + sw[0] - bx - o[0], py = ne[1] + by - Y / k - o[1];
        return [(px * ey[1] - py * ey[0]) / det, (py * ex[0] - px * ex[1]) / det];
      },
      unitVB: Math.hypot(ex[0], ex[1]) * k,                    // vb length of 1 TikZ unit (x)
    };
  }

  const f3 = (v) => (Math.abs(v) < 1e-9 ? 0 : +v.toFixed(3));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---- number composition from the \dlnum sample --------------------------------
  // \dlnum = -0.0123456789\times10^{-0123456789}: 27 glyphs, in this order
  const DLNUM = "−0.0123456789×10−0123456789";
  function formatNumber(v, o) {
    if (!isFinite(v)) return { mant: "0", exp: null };
    if (o.digits != null) return { mant: v.toFixed(o.digits), exp: null };
    const sig = o.sig || 3, a = Math.abs(v), lo = o.sciBelow ?? 1e-2, hi = o.sciAbove ?? 1e4;
    if (a === 0) return { mant: "0", exp: null };
    if (a >= lo && a < hi) {
      let m = v.toPrecision(sig);
      if (/e/.test(m)) m = (+m).toString();
      if (o.trim !== false && m.includes(".")) m = m.replace(/\.?0+$/, "");   // 3.00 -> 3, 0.600 -> 0.6
      return { mant: m, exp: null };
    }
    let exp = Math.floor(Math.log10(a)), d = Math.max(0, (o.sciSig || 2) - 1);
    let mant = (v / 10 ** exp).toFixed(d);
    if (Math.abs(+mant) >= 10) { exp += 1; mant = (v / 10 ** exp).toFixed(d); }
    return { mant, exp };
  }

  // ---- geometric clipping (in viewBox units) ---------------------------------------
  // Done in JS rather than with SVG clip-path, so the build's PNG snapshots (MuPDF
  // ignores clip-path) show exactly what the browser shows.
  function clipSegment(p, q, c) {            // Liang-Barsky; c = [x0, y0, x1, y1]
    let t0 = 0, t1 = 1;
    const dx = q[0] - p[0], dy = q[1] - p[1];
    for (const [pp, qq] of [[-dx, p[0] - c[0]], [dx, c[2] - p[0]], [-dy, p[1] - c[1]], [dy, c[3] - p[1]]]) {
      if (pp === 0) { if (qq < 0) return null; continue; }
      const r = qq / pp;
      if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [[p[0] + t0 * dx, p[1] + t0 * dy], [p[0] + t1 * dx, p[1] + t1 * dy], t0 > 0, t1 < 1];
  }
  function clipPolyline(Q, c) {               // -> list of runs
    const runs = [];
    let cur = null;
    for (let i = 0; i + 1 < Q.length; i++) {
      const r = clipSegment(Q[i], Q[i + 1], c);
      if (!r) { cur = null; continue; }
      if (!cur || r[2]) { cur = [r[0]]; runs.push(cur); }
      cur.push(r[1]);
      if (r[3]) cur = null;
    }
    return runs;
  }
  function clipPolygon(Q, c) {                // Sutherland-Hodgman
    let poly = Q;
    const edges = [[(p) => p[0] >= c[0], (p, q) => [c[0], p[1] + (q[1] - p[1]) * (c[0] - p[0]) / (q[0] - p[0])]],
      [(p) => p[0] <= c[2], (p, q) => [c[2], p[1] + (q[1] - p[1]) * (c[2] - p[0]) / (q[0] - p[0])]],
      [(p) => p[1] >= c[1], (p, q) => [p[0] + (q[0] - p[0]) * (c[1] - p[1]) / (q[1] - p[1]), c[1]]],
      [(p) => p[1] <= c[3], (p, q) => [p[0] + (q[0] - p[0]) * (c[3] - p[1]) / (q[1] - p[1]), c[3]]]];
    for (const [inside, cut] of edges) {
      const res = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        if (inside(b)) { if (!inside(a)) res.push(cut(a, b)); res.push(b); }
        else if (inside(a)) res.push(cut(a, b));
      }
      poly = res;
      if (!poly.length) break;
    }
    return poly;
  }

  // ---- the drawing context handed to spec.draw ---------------------------------
  function makeDrawer(fig, out) {
    const { M, P, data } = fig;
    const k = M.k, warn = fig.warn;
    const clips = [];                          // stack of [x0, y0, x1, y1] in vb
    const clip = () => clips[clips.length - 1];
    const inside = (q) => !clips.length || (q[0] >= clip()[0] - 1e-6 && q[0] <= clip()[2] + 1e-6 && q[1] >= clip()[1] - 1e-6 && q[1] <= clip()[3] + 1e-6);
    const node = (name) => {
      const n = data.nodes[name];
      if (!n) throw new Error(`no exported node "${name}". Add [export] to it in the .tex (exported: ${Object.keys(data.nodes).slice(0, 12).join(", ")}${Object.keys(data.nodes).length > 12 ? ", ..." : ""})`);
      return n;
    };
    const ANCH = { center: [0.5, 0.5], north: [0.5, 1], south: [0.5, 0], east: [1, 0.5], west: [0, 0.5],
      "north east": [1, 1], "north west": [0, 1], "south east": [1, 0], "south west": [0, 0] };
    // any point: [x, y] in TikZ units, "name" (centre) or "name.north east"
    function V(p) {
      if (Array.isArray(p)) {
        if (!isFinite(p[0]) || !isFinite(p[1])) throw new Error(`non-finite point [${p}]`);
        const q = M.xy(p);
        if (!clips.length && (q[0] < -1 || q[1] < -1 || q[0] > fig.vb[0] + 1 || q[1] > fig.vb[1] + 1)) fig.outside++;
        return q;
      }
      const [name, a] = String(p).split(/\.(?=[a-z ]+$)/);
      const n = node(name), f = ANCH[a || "center"];
      if (!f) throw new Error(`unknown anchor "${a}"`);
      return M.pt([n.sw[0] + f[0] * (n.ne[0] - n.sw[0]), n.sw[1] + f[1] * (n.ne[1] - n.sw[1])]);
    }
    const stroke = (o, dfltW) => {
      const w = widthOf(o.width, dfltW) * k;
      let s = ` stroke="${colorOf(P, o.color)}" stroke-width="${f3(w)}" stroke-linecap="round" stroke-linejoin="round"`;
      if (o.opacity != null) s += ` stroke-opacity="${o.opacity}"`;
      if (o.dash) s += ` stroke-dasharray="${o.dash === true ? `${f3(3 * k)} ${f3(3 * k)}` : o.dash.map((x) => f3(x * k)).join(" ")}"`;
      return s;
    };
    const fill = (o) => (o.fill ? ` fill="${colorOf(P, o.fill === true ? o.color : o.fill)}"${o.fillOpacity != null ? ` fill-opacity="${o.fillOpacity}"` : ""}` : ` fill="none"`);
    // Latex[length=2.2mm,width=1.6mm] tip at b, pointing from a to b (dlviz default)
    function tip(a, b, o) {
      const L = (o.tipLength ?? 6.26) * k, W = (o.tipWidth ?? 4.55) * k;
      const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
      const bx = b[0] - ux * L, by = b[1] - uy * L, px = -uy * W / 2, py = ux * W / 2;
      const c = colorOf(P, o.color);
      out.push(`<path d="M${f3(b[0])},${f3(b[1])} Q${f3(bx + ux * L * 0.25 + px * 0.5)},${f3(by + uy * L * 0.25 + py * 0.5)} ${f3(bx + px)},${f3(by + py)} L${f3(bx + ux * L * 0.18)},${f3(by + uy * L * 0.18)} L${f3(bx - px)},${f3(by - py)} Q${f3(bx + ux * L * 0.25 - px * 0.5)},${f3(by + uy * L * 0.25 - py * 0.5)} ${f3(b[0])},${f3(b[1])}Z" fill="${c}"${o.opacity != null ? ` fill-opacity="${o.opacity}"` : ""}/>`);
      return [bx + ux * L * 0.5, by + uy * L * 0.5];            // where the shaft should stop
    }
    const ptsAttr = (Q) => Q.map((q) => `${f3(q[0])},${f3(q[1])}`).join(" ");
    // polyline / polygon in vb units, clipped to the current clip rectangle
    function emit(Q, o) {
      if (o.closed) {
        const poly = clips.length ? clipPolygon(Q, clip()) : Q;
        if (poly.length > 2) out.push(`<polygon points="${ptsAttr(poly)}"${stroke(o, 0.8)}${fill(o)}/>`);
        return;
      }
      const end = Q[Q.length - 1], withTip = o.arrow && inside(end);
      if (withTip) { Q = Q.slice(); Q[Q.length - 1] = tip(Q[Q.length - 2], end, o); }
      const runs = clips.length ? clipPolyline(Q, clip()) : [Q];
      for (const R of runs) if (R.length > 1) out.push(`<polyline points="${ptsAttr(R)}"${stroke(o, 0.8)} fill="none"/>`);
    }
    const glyph = (g, color, dx = 0, dy = 0, sx = 1) =>
      `<use xlink:href="#${g.id}" transform="matrix(${+(g.s * sx).toFixed(5)},0,0,${-g.s},${f3(g.x + dx)},${f3(g.y + dy)})" fill="${color}"/>`;
    // glyph layout of a live number (see d.number)
    function layoutNumber(id, v, o) {
      const s = slot(id);
      if (!s.num) throw new Error(`live slot "${id}" is not a number slot: its node must contain exactly \\(\\dlnum\\) (or \\dlnumin{width})`);
      const G = s.glyphs, color = o.color ? colorOf(P, o.color) : slotColor(s);
      let { mant, exp } = formatNumber(v, o);
      if (o.leadingZero === false) mant = mant.replace(/^(-?)0\./, "$1.");
      if (/^-0?\.?0*$/.test(mant)) mant = mant.slice(1);          // no "-0.00"
      const minusAdv = G[1].x - G[0].x, dAdv = G[4].x - G[3].x, dotAdv = G[3].x - G[2].x;
      const parts = [];
      let x = G[0].x;
      for (const ch of mant) {
        if (ch === "-") {                                     // narrowMinus: for tight cells
          parts.push([G[0], x, G[0].y, o.narrowMinus ? 0.75 : 1]); x += o.narrowMinus ? minusAdv * 0.78 : minusAdv;
        } else if (ch === ".") { parts.push([G[2], x]); x += dotAdv; }
        else { parts.push([G[3 + +ch], x, G[3].y]); x += dAdv; }
      }
      if (exp != null) {
        const off = x - (G[12].x + dAdv), supAdv = G[18].x - G[17].x;
        for (const g of G.slice(13, 16)) parts.push([g, g.x + off]);
        let xs = G[16].x + off;
        if (exp < 0) { parts.push([G[16], xs]); xs = G[17].x + off; }
        for (const ch of String(Math.abs(exp))) { parts.push([G[17 + +ch], xs]); xs += supAdv; }
        x = xs;
      }
      // horizontal placement: default = left edge where TeX put the sample.
      // o.at (point or node): put its o.align ("left" | "center" | "right") at that x.
      const x0 = G[0].x, right = G[26].x + (G[26].x - G[25].x);
      let shift = 0;
      if (o.at != null) {
        const tx = V(o.at)[0], a = o.align || "center";
        shift = a === "left" ? tx - x0 : a === "right" ? tx - x : tx - (x0 + x) / 2;
      } else if (o.align === "right") shift = right - x;
      else if (o.align === "center") shift = (right - x) / 2;
      const [tx, ty] = o.dx != null || o.dy != null ? [(o.dx || 0) * M.unitVB, -(o.dy || 0) * M.unitVB] : [0, 0];
      return { parts, color, x0, x1: x, dx: shift + tx, dy: ty, baseline: G[3].y };
    }
    const slotColor = (s) => (s.colors && s.colors[fig.theme]) || s.color;
    const slot = (id) => {
      const s = data.live[id];
      if (!s) throw new Error(`no live slot "${id}". Add a node [live=${id}] in the .tex (slots: ${Object.keys(data.live).join(", ") || "none"})`);
      return s;
    };

    const d = {
      P, map: M,
      /** vb coordinates of a point, for d.raw() */
      X: V,
      /** box of an exported node, in TikZ units: {sw, ne, c, w, h} */
      box(name) {
        const n = node(name), a = M.inv(...M.pt(n.sw)), b = M.inv(...M.pt(n.ne)), c = M.inv(...M.pt(n.c));
        return { sw: a, ne: b, c, w: b[0] - a[0], h: b[1] - a[1] };
      },
      color: (c) => colorOf(P, c),
      path(points, o = {}) {
        if (points.length < 2) return d;
        emit(points.map(V), o);
        if (o.dots) {
          const r = (o.dots === true ? 1.1 : o.dots) * k, c = colorOf(P, o.dotColor || o.color);
          const from = o.dotsFrom ?? 1;
          for (const q of points.slice(from).map(V)) if (inside(q)) out.push(`<circle cx="${f3(q[0])}" cy="${f3(q[1])}" r="${f3(r)}" fill="${c}"/>`);
        }
        return d;
      },
      /** straight line, or curved with o.bend = degrees (TikZ "bend left"; negative = right) */
      line(a, b, o = {}) {
        if (!o.bend) return d.path([a, b], o);
        const p = V(a), q = V(b), dist = Math.hypot(q[0] - p[0], q[1] - p[1]), L = 0.3915 * dist;
        const ang = Math.atan2(q[1] - p[1], q[0] - p[0]), t = (-o.bend * Math.PI) / 180;  // SVG y points down
        const c1 = [p[0] + L * Math.cos(ang + t), p[1] + L * Math.sin(ang + t)];
        const c2 = [q[0] - L * Math.cos(ang - t), q[1] - L * Math.sin(ang - t)];
        const Q = [];
        for (let i = 0; i <= 32; i++) {
          const t = i / 32, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
          Q.push([a * p[0] + b * c1[0] + c * c2[0] + e * q[0], a * p[1] + b * c1[1] + c * c2[1] + e * q[1]]);
        }
        emit(Q, o);
        return d;
      },
      arrow(a, b, o = {}) { return d.path([a, b], Object.assign({ arrow: true }, o)); },
      /** filled dot, radius in pt (default 1.6pt, like the w* dot) */
      dot(p, o = {}) {
        const q = V(p);
        if (!inside(q)) return d;
        out.push(`<circle cx="${f3(q[0])}" cy="${f3(q[1])}" r="${f3((o.r ?? 1.6) * k)}" fill="${colorOf(P, o.color)}"${o.opacity != null ? ` fill-opacity="${o.opacity}"` : ""}/>`);
        return d;
      },
      /** circle outline, radius in pt (o.rUnits for TikZ units) */
      circle(p, r, o = {}) {
        const q = V(p), R = o.rUnits ? r * M.unitVB : r * k;
        if (!inside(q)) return d;
        out.push(`<circle cx="${f3(q[0])}" cy="${f3(q[1])}" r="${f3(R)}"${stroke(o, 0.6)}${fill(o)}/>`);
        return d;
      },
      /** rectangle between two corners (points or node anchors) */
      rect(a, b, o = {}) {
        const p = V(a), q = V(b);
        let x = Math.min(p[0], q[0]), y = Math.min(p[1], q[1]), x1 = Math.max(p[0], q[0]), y1 = Math.max(p[1], q[1]);
        if (clips.length) { const c = clip(); x = Math.max(x, c[0]); y = Math.max(y, c[1]); x1 = Math.min(x1, c[2]); y1 = Math.min(y1, c[3]); if (x1 <= x || y1 <= y) return d; }
        const r = o.round != null ? ` rx="${f3(o.round * k)}"` : "";
        out.push(`<rect x="${f3(x)}" y="${f3(y)}" width="${f3(x1 - x)}" height="${f3(y1 - y)}"${r}${o.color || o.width ? stroke(o, 0.4) : ' stroke="none"'}${fill(o)}/>`);
        return d;
      },
      /** dlviz "hl": thick rounded outline around one node or the span of several */
      hl(names, o = {}) {
        const L = [].concat(names).map(node);
        const sw = [Math.min(...L.map((n) => n.sw[0])), Math.min(...L.map((n) => n.sw[1]))];
        const ne = [Math.max(...L.map((n) => n.ne[0])), Math.max(...L.map((n) => n.ne[1]))];
        const a = M.pt(sw), b = M.pt(ne);
        out.push(`<rect x="${f3(a[0])}" y="${f3(b[1])}" width="${f3(b[0] - a[0])}" height="${f3(a[1] - b[1])}" rx="${f3(1 * k)}"${stroke(Object.assign({ color: "red", width: "very thick" }, o), 1.2)} fill="none"/>`);
        return d;
      },
      /** dim nodes (or a rect given as [a, b]) by painting the page colour over them */
      shade(names, o = {}) {
        const L = [].concat(names);
        const boxes = Array.isArray(L[0]) ? [[V(L[0]), V(L[1])]] : L.map(node).map((n) => [M.pt(n.sw), M.pt(n.ne)]);
        const c = colorOf(P, o.color || "bg"), op = o.opacity ?? 0.6;
        for (const [a, b] of boxes) out.push(`<rect x="${f3(Math.min(a[0], b[0]))}" y="${f3(Math.min(a[1], b[1]))}" width="${f3(Math.abs(b[0] - a[0]))}" height="${f3(Math.abs(b[1] - a[1]))}" fill="${c}" fill-opacity="${op}"/>`);
        return d;
      },
      /** a live number: TeX glyphs from the slot's \dlnum sample */
      number(id, v, o = {}) {
        const L = layoutNumber(id, v, o);
        for (const [g, gx, gy, sx] of L.parts) out.push(glyph(Object.assign({}, g, { x: gx, y: gy ?? g.y }), L.color, L.dx, L.dy, sx));
        return d;
      },
      /** where d.number(id, v, o) would put the number: {left, right, baseline} in TikZ units */
      measure(id, v, o = {}) {
        const L = layoutNumber(id, v, o), y = L.baseline + L.dy;
        return { left: M.inv(L.x0 + L.dx, y)[0], right: M.inv(L.x1 + L.dx, y)[0], baseline: M.inv(L.x0 + L.dx, y)[1] };
      },
      /** a live label: the slot's glyphs as typeset, optionally moved {from, to} or {dx, dy} */
      label(id, o = {}) {
        const s = slot(id), color = o.color ? colorOf(P, o.color) : slotColor(s);
        let dx = 0, dy = 0;
        if (o.from && o.to) { const a = M.xy(o.from), b = M.xy(o.to); dx = b[0] - a[0]; dy = b[1] - a[1]; }
        else if (o.dx != null || o.dy != null) { const a = M.xy([0, 0]), b = M.xy([o.dx || 0, o.dy || 0]); dx = b[0] - a[0]; dy = b[1] - a[1]; }
        let halo = "";
        if (o.halo) {                       // knockout: page colour behind the label
          const n = data.nodes["live:" + id], a = M.pt(n.sw), b = M.pt(n.ne);
          halo = `<rect x="${f3(a[0] + dx)}" y="${f3(b[1] + dy)}" width="${f3(b[0] - a[0])}" height="${f3(a[1] - b[1])}" rx="${f3(1.5 * k)}" fill="${colorOf(P, "bg")}" fill-opacity="${o.halo === true ? 0.85 : o.halo}"/>`;
        }
        const g = halo + `<g${o.opacity != null ? ` opacity="${o.opacity}"` : ""}>` + s.glyphs.map((g) => glyph(g, color, dx, dy)).join("") + "</g>";
        out.push(g);
        return d;
      },
      /** group with opacity and/or a clip rectangle [a, b] */
      group(o, fn) {
        if (o.clip) {
          const a = V(o.clip[0]), b = V(o.clip[1]);
          let c = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
          if (clips.length) { const p = clip(); c = [Math.max(c[0], p[0]), Math.max(c[1], p[1]), Math.min(c[2], p[2]), Math.min(c[3], p[3])]; }
          clips.push(c);
        }
        out.push(o.opacity != null ? `<g opacity="${o.opacity}">` : "<g>");
        try { fn(d); } finally { out.push("</g>"); if (o.clip) clips.pop(); }
        return d;
      },
      /** escape hatch: raw SVG in viewBox units (use d.X(p) to map points) */
      raw(svg) { out.push(svg); return d; },
    };
    return d;
  }

  // ---- figure object --------------------------------------------------------------
  function createFigure(data, spec, theme) {
    const M = makeMap(data.frame);
    const fig = { data, spec, M, vb: data.vb, clipN: 0, outside: 0, warnings: [] };
    // data.themes lists the themes the scaffold was compiled in; the overlay
    // follows whichever one is showing
    fig.setTheme = (t) => {
      fig.theme = (data.themes || [data.theme]).includes(t) ? t : data.theme;
      fig.P = makePalette(fig.theme);
    };
    fig.setTheme(theme || data.theme);
    fig.warn = (m) => fig.warnings.push(m);
    for (const id of Object.keys(data.live)) {
      const s = data.live[id];
      s.num = s.glyphs.length === 27 && s.glyphs.map((g) => g.ch).join("") === DLNUM;
    }
    // default state
    fig.initial = () => {
      const s = { hover: null };
      for (const [k, p] of Object.entries(spec.params || {})) s[k] = p.value ?? p.min;
      for (const [k, h] of Object.entries(spec.handles || {})) s[k] = h.value.slice();
      for (const [k, v] of Object.entries(spec.initial || {})) s[k] = Array.isArray(v) ? v.slice() : v;
      return s;
    };
    let memo = { key: null, c: null };
    fig.compute = (s) => {
      if (!spec.compute) return {};
      const key = JSON.stringify(Object.keys(s).filter((k) => k !== "hover").map((k) => s[k]));
      if (memo.key !== key) memo = { key, c: spec.compute(s) };
      return memo.c;
    };
    fig.hotspots = () => {
      const h = spec.hotspots;
      if (!h) return [];
      const names = Object.keys(data.nodes);
      if (Array.isArray(h)) return h;
      if (h instanceof RegExp) return names.filter((n) => h.test(n));
      if (typeof h === "function") return names.filter(h);
      return [];
    };
    // overlay markup for state s (no DOM)
    // the drawing (re-rendered on every change)
    fig.renderDraw = (s) => {
      const out = [];
      fig.clipN = 0; fig.outside = 0;
      const d = makeDrawer(fig, out);
      const c = fig.compute(s);
      if (spec.draw) spec.draw(d, s, c);
      if (fig.outside) fig.warn(`${fig.outside} point(s) fall outside the viewBox: enlarge \\useasboundingbox or clip with d.group({clip: [a, b]}, ...)`);
      return out.join("");
    };
    // hotspots and handles (built once in the browser, so hover and focus survive redraws)
    fig.renderUI = (s) => {
      // hotspots: invisible, above the drawing
      const hot = fig.hotspots().map((name) => {
        const n = data.nodes[name];
        if (!n) throw new Error(`hotspot "${name}" is not an exported node`);
        const a = M.pt(n.sw), b = M.pt(n.ne);
        return `<rect class="dl-hot" data-hot="${esc(name)}" tabindex="0" x="${f3(a[0])}" y="${f3(b[1])}" width="${f3(b[0] - a[0])}" height="${f3(a[1] - b[1])}" fill="#fff" fill-opacity="0"/>`;
      }).join("");
      // handles: dot + faint ring + generous hit area
      const hd = Object.entries(spec.handles || {}).map(([k, h]) => {
        const q = M.xy(s[k]), col = colorOf(fig.P, h.color || "fg");
        return `<g class="dl-handle" data-handle="${esc(k)}" transform="translate(${f3(q[0])},${f3(q[1])})" tabindex="0" role="slider" aria-label="${esc(h.label || k)}">` +
          `<circle r="${f3(4.2 * M.k)}" fill="none" stroke="${col}" stroke-opacity=".4" stroke-width="${f3(0.6 * M.k)}"/>` +
          `<circle r="${f3((h.r ?? 1.6) * M.k)}" fill="${col}"/>` +
          `<circle class="dl-hit" r="${f3(9 * M.k)}" fill="#fff" fill-opacity="0"/></g>`;
      }).join("");
      return hot + hd;
    };
    fig.render = (s) => fig.renderDraw(s) + fig.renderUI(s);
    return fig;
  }

  // ---- browser mount -----------------------------------------------------------------
  // Markup (written by build.py, standalone page or book fragment):
  //   <div class="dl-live" data-dl="name">
  //     <svg class="dl-svg">  <g class="dl-scaffold dl-th-dark"> [<g class="dl-scaffold dl-th-light">]
  //                           <g class="dl-overlay"> </svg>
  //     <div class="dl-controls"><div class="dl-sliders"></div><div class="dl-buttons"></div></div>
  //     <script type="application/json" class="dl-data">...<\/script>   (escaped: this file is inlined into <script> tags)
  //   </div>
  // Several figures can share a page; each gets its own state.
  function pageTheme() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t === "dark" || t === "light") return t;
    return window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  const mounted = [];
  function onThemeChange() { const t = pageTheme(); for (const m of mounted) m.theme(t); }
  let themeWatch = false;
  function watchTheme() {
    if (themeWatch) return;
    themeWatch = true;
    new MutationObserver(onThemeChange).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    if (window.matchMedia) matchMedia("(prefers-color-scheme: light)").addEventListener("change", onThemeChange);
  }

  function mount(rootEl, data, spec) {
    const name = rootEl.dataset.dl || "fig";
    const fig = createFigure(data, spec, pageTheme());
    const svg = rootEl.querySelector(".dl-svg"), ov = rootEl.querySelector(".dl-overlay");
    const controls = rootEl.querySelector(".dl-controls");
    let s = fig.initial();
    let raf = 0;
    // a hidden tab gets no animation frames: draw at once then, so state and picture never drift apart
    const update = () => { if (document.hidden) { cancelAnimationFrame(raf); draw(); } else if (!raf) raf = requestAnimationFrame(draw); };
    let drawG, uiG;
    function buildUI() {
      ov.innerHTML = `<g class="dl-draw"></g><g class="dl-ui">${fig.renderUI(s)}</g>`;
      drawG = ov.firstChild; uiG = ov.lastChild;
    }
    function draw() {
      raf = 0;
      try { drawG.innerHTML = fig.renderDraw(s); } catch (e) { console.error(`[${name}]`, e); }
      for (const el of uiG.querySelectorAll(".dl-handle")) {
        const q = fig.M.xy(s[el.dataset.handle]);
        el.setAttribute("transform", `translate(${f3(q[0])},${f3(q[1])})`);
      }
      syncControls();
    }
    const setHover = (v) => { if (s.hover !== v) { s.hover = v; update(); } };
    buildUI();

    // sliders
    const inputs = {};
    for (const [k, p] of Object.entries(spec.params || {})) {
      if (p.hidden) continue;
      const row = document.createElement("label");
      row.className = "dl-ctl";
      // log: true -> the slider moves in log10 units (step in decades), the state holds the value
      const lg = !!p.log, lo = lg ? Math.log10(p.min) : p.min, hi = lg ? Math.log10(p.max) : p.max;
      const step = p.step || (lg ? 0.1 : (p.max - p.min) / 100);
      const dig = p.digits ?? (lg ? null : Math.max(0, -Math.floor(Math.log10(step))));
      row.innerHTML = `<span class="dl-sym">${esc(p.label || k)}</span><input type="range" id="dl-${esc(name)}-${esc(k)}" min="${lo}" max="${hi}" step="${step}" value="${lg ? Math.log10(s[k]) : s[k]}"><output></output>`;
      const inp = row.querySelector("input"), outEl = row.querySelector("output");
      inp.addEventListener("input", () => { stopPlay(); s[k] = lg ? +(10 ** +inp.value).toPrecision(6) : +inp.value; update(); });
      inputs[k] = { inp, outEl, dig, lg };
      controls.querySelector(".dl-sliders").appendChild(row);
    }
    function syncControls() {
      for (const [k, c] of Object.entries(inputs)) {
        const v = c.lg ? Math.log10(s[k]) : s[k];
        if (Math.abs(+c.inp.value - v) > 1e-9) c.inp.value = v;
        c.outEl.textContent = c.dig != null ? (+s[k]).toFixed(c.dig)
          : s[k] >= 0.01 && s[k] < 1e4 ? String(+(+s[k]).toPrecision(2)) : (+s[k]).toExponential(0);
      }
    }
    // play / reset
    const btns = controls.querySelector(".dl-buttons");
    let anim = null;
    const playBtn = spec.play ? document.createElement("button") : null;
    function stopPlay() { if (!anim) return; cancelAnimationFrame(anim.raf); anim = null; if (playBtn) playBtn.textContent = "▶ Play"; }
    if (playBtn) {
      const pp = spec.params[spec.play.param];
      if (!pp) throw new Error(`play.param "${spec.play.param}" is not in params`);
      playBtn.type = "button"; playBtn.className = "dl-primary"; playBtn.textContent = "▶ Play";
      playBtn.addEventListener("click", () => {
        if (anim) { stopPlay(); return; }
        const step = pp.step || 1, ms = spec.play.ms || 120, n = Math.round((pp.max - pp.min) / step);
        anim = { t0: performance.now() }; playBtn.textContent = "■ Stop";
        const tick = (now) => {
          const i = Math.min(n, Math.floor((now - anim.t0) / ms));
          s[spec.play.param] = +(pp.min + i * step).toFixed(10); update();
          if (i < n && anim) anim.raf = requestAnimationFrame(tick); else stopPlay();
        };
        anim.raf = requestAnimationFrame(tick);
      });
      btns.appendChild(playBtn);
    }
    const reset = document.createElement("button");
    reset.type = "button"; reset.textContent = "Reset";
    reset.addEventListener("click", () => { stopPlay(); const h = s.hover; s = fig.initial(); if (!spec.initial || !("hover" in spec.initial)) s.hover = h; update(); });
    btns.appendChild(reset);

    // handles: drag with pointer, nudge with arrow keys
    const toVB = (e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const clampH = (k, p) => {
      const h = spec.handles[k], lo = h.min || [-Infinity, -Infinity], hi = h.max || [Infinity, Infinity];
      let q = [Math.min(hi[0], Math.max(lo[0], p[0])), Math.min(hi[1], Math.max(lo[1], p[1]))];
      if (typeof h.snap === "number") q = q.map((v) => Math.round(v / h.snap) * h.snap);
      else if (Array.isArray(h.snap)) {                       // snap to listed points nearby
        const r = h.snapRadius ?? 0.15;
        let best = null, bd = r;
        for (const t of h.snap) { const dd = Math.hypot(t[0] - q[0], t[1] - q[1]); if (dd <= bd) { bd = dd; best = t; } }
        if (best) q = best.slice();
      }
      return q.map((v) => +v.toFixed(4));
    };
    let drag = null;
    svg.addEventListener("pointerdown", (e) => {
      const h = e.target.closest && e.target.closest(".dl-handle");
      if (!h || e.button > 0) return;
      e.preventDefault(); stopPlay();
      drag = { id: e.pointerId, k: h.dataset.handle };
      svg.setPointerCapture(e.pointerId); svg.classList.add("dl-dragging");
    });
    svg.addEventListener("pointermove", (e) => {
      if (drag && e.pointerId === drag.id) { const p = toVB(e); s[drag.k] = clampH(drag.k, fig.M.inv(p.x, p.y)); update(); }
    });
    const end = (e) => { if (drag && e.pointerId === drag.id) { drag = null; svg.classList.remove("dl-dragging"); } };
    svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
    svg.addEventListener("touchstart", (e) => { if (e.target.closest && e.target.closest(".dl-handle")) e.preventDefault(); }, { passive: false });
    svg.addEventListener("keydown", (e) => {
      const h = e.target.closest && e.target.closest(".dl-handle");
      if (!h) return;
      const k = h.dataset.handle, st = (spec.handles[k].keyStep || 0.1) * (e.shiftKey ? 5 : 1);
      const dv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
      if (!dv) return;
      e.preventDefault(); s[k] = clampH(k, [s[k][0] + dv[0], s[k][1] + dv[1]]); update();
    });
    // hotspots: hover (mouse), tap toggles (touch), focus (keyboard)
    const hotOf = (e) => e.target.closest && e.target.closest(".dl-hot");
    svg.addEventListener("pointerover", (e) => { const h = hotOf(e); if (h && e.pointerType === "mouse") setHover(h.dataset.hot); });
    svg.addEventListener("pointerout", (e) => {
      const h = hotOf(e);
      if (h && e.pointerType === "mouse" && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".dl-hot"))) {
        if (!spec.stickyHover) setHover(null);
      }
    });
    svg.addEventListener("click", (e) => { const h = hotOf(e); if (h) setHover(s.hover === h.dataset.hot && e.pointerType !== "mouse" ? null : h.dataset.hot); });
    svg.addEventListener("focusin", (e) => { const h = hotOf(e); if (h && e.target.matches(":focus-visible")) setHover(h.dataset.hot); });
    svg.addEventListener("focusout", (e) => { const h = hotOf(e); if (h && !spec.stickyHover && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".dl-hot"))) setHover(null); });

    if (!controls.querySelector(".dl-ctl") && !playBtn && !Object.keys(spec.handles || {}).length && !spec.hotspots) controls.hidden = true;
    draw();
    const api = {
      name, state: () => s,
      set(over) { Object.assign(s, over); update(); },
      theme(t) { if (t === fig.theme) return; fig.setTheme(t); buildUI(); draw(); },
    };
    mounted.push(api);
    watchTheme();
    return api;
  }

  // ---- entry points ---------------------------------------------------------------------
  // A standalone page runs figure.js directly: it calls DLLive.figure(spec).
  // A page with several figures wraps each spec: DLLive.load("name", function (DLLive) { ...spec... }),
  // so each spec's top-level helpers stay private and DLLive.figure() knows which figure it is.
  const specs = {};
  function mountName(name) {
    const el = document.querySelector(`.dl-live[data-dl="${CSS.escape(name)}"]`);
    if (!el || el.dataset.dlMounted) return;
    const dj = el.querySelector("script.dl-data");
    if (!dj) { console.error(`[${name}] no dl-data`); return; }
    el.dataset.dlMounted = "1";
    try { mount(el, JSON.parse(dj.textContent), specs[name]); } catch (e) { console.error(`[${name}]`, e); }
  }
  const whenReady = (fn) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn());
  const DLLive = {
    PALETTES, makePalette, colorOf, makeMap, formatNumber, createFigure, DLNUM,
    spec: null, mounted,
    /** standalone: the page's single figure (or, under node, just record the spec) */
    figure(spec) {
      DLLive.spec = spec;
      if (typeof document !== "undefined") {
        const el = document.querySelector(".dl-live");
        if (el) { specs[el.dataset.dl || "fig"] = spec; whenReady(() => mountName(el.dataset.dl || "fig")); }
      }
    },
    /** several figures per page */
    load(name, fn) {
      const local = Object.assign(Object.create(DLLive), { figure(spec) { specs[name] = spec; DLLive.spec = spec; } });
      fn(local);
      if (typeof document !== "undefined") whenReady(() => mountName(name));
    },
    /** the figure api ({state, set, theme}) by name, for the console */
    get(name) { return mounted.find((m) => m.name === name); },
    state(name) { const m = name ? DLLive.get(name) : mounted[0]; return m && m.state(); },
  };
  root.DLLive = DLLive;
  if (typeof module !== "undefined") module.exports = DLLive;
})(typeof window !== "undefined" ? window : globalThis);
