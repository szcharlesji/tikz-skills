// Run a figure spec under node, without a browser: render the overlay for the
// default state and every spec.snapshots entry, run spec.tests, and report
// errors and warnings. Called by build.py; prints one JSON object.
//   node snapshot.cjs <data.json> <dllive.js> <figure.js>
"use strict";
const fs = require("fs"), vm = require("vm");
const [dataPath, runtimePath, specPath] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const ctx = { console, Math, JSON, globalThis: null };
ctx.globalThis = ctx;
vm.createContext(ctx);
const result = { snapshots: [], tests: [], errors: [], warnings: [], meta: {} };
try {
  vm.runInContext(fs.readFileSync(runtimePath, "utf8"), ctx, { filename: "dllive.js" });
  vm.runInContext(fs.readFileSync(specPath, "utf8"), ctx, { filename: specPath });
} catch (e) {
  result.errors.push(`loading ${specPath}: ${e.stack || e}`);
  console.log(JSON.stringify(result)); process.exit(0);
}
const DL = ctx.DLLive, spec = DL.spec;
if (!spec) {
  result.errors.push(`${specPath} never called DLLive.figure({...})`);
  console.log(JSON.stringify(result)); process.exit(0);
}
result.meta = { title: spec.title || "", caption: spec.caption || "", alt: spec.alt || spec.title || "" };
const fig = DL.createFigure(data, spec);
const states = [{ name: "default", over: {} }].concat(
  (spec.snapshots || []).map((o, i) => ({ name: o.name || `snap-${i + 1}`, over: o })));
for (const st of states) {
  const s = Object.assign(fig.initial(), st.over);
  delete s.name;
  try {
    fig.warnings = [];
    const svg = fig.render(s);
    result.snapshots.push({ name: st.name, svg, state: s });
    for (const w of fig.warnings) result.warnings.push(`[${st.name}] ${w}`);
  } catch (e) {
    result.errors.push(`[${st.name}] draw/compute failed: ${e.stack || e}`);
  }
}
// the default state in every other theme the scaffold was compiled in
for (const t of (data.themes || []).slice(1)) {
  try { fig.setTheme(t); result.snapshots.push({ name: "default", theme: t, svg: fig.render(fig.initial()), state: fig.initial() }); }
  catch (e) { result.errors.push(`[${t}] draw failed: ${e.stack || e}`); }
}
fig.setTheme(data.theme);
for (const [i, t] of (spec.tests || []).entries()) {
  const s = Object.assign(fig.initial(), t.state || {});
  try {
    const c = spec.compute ? spec.compute(s) : {};
    const r = t.check(c, s);
    result.tests.push({ name: t.name || `test-${i + 1}`, ok: r === true, msg: r === true ? "" : String(r) });
  } catch (e) {
    result.tests.push({ name: t.name || `test-${i + 1}`, ok: false, msg: String(e.stack || e) });
  }
}
// static checks of the spec itself
for (const [k, p] of Object.entries(spec.params || {})) {
  if (p.min == null || p.max == null) result.errors.push(`param "${k}" needs min and max`);
  const v = p.value ?? p.min;
  if (v < p.min || v > p.max) result.errors.push(`param "${k}": value ${v} outside [${p.min}, ${p.max}]`);
  if (p.log && !(p.min > 0)) result.errors.push(`param "${k}": log: true needs min > 0`);
}
for (const [k, h] of Object.entries(spec.handles || {}))
  if (!Array.isArray(h.value) || h.value.length !== 2) result.errors.push(`handle "${k}" needs value: [x, y]`);
if (spec.play && !(spec.params || {})[spec.play.param]) result.errors.push(`play.param "${spec.play.param}" is not a param`);
if (spec.hotspots) {
  const hs = fig.hotspots();
  result.meta.hotspots = hs.length;
  if (!hs.length) result.errors.push(`hotspots matched no exported node (exported: ${Object.keys(data.nodes).slice(0, 20).join(", ")})`);
}
for (const k of Object.keys(spec.initial || {}))
  if (k !== "hover" && !(k in (spec.params || {})) && !(k in (spec.handles || {}))) result.errors.push(`initial.${k} is not a param, handle or "hover"`);
console.log(JSON.stringify(result));
