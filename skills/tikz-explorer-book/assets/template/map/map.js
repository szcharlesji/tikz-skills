// Concept map on the explorer's home page: a force layout anchored by family, with
// Obsidian-style hover highlighting, a detail panel and a guided tour.
(function () {
  var host = document.getElementById("mapCanvas");
  if (!host || !window.d3) return;
  var data = JSON.parse(document.getElementById("mapData").textContent);
  var chapters = JSON.parse(document.getElementById("chapterTitles").textContent);
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 1000, H = 660, CX = W / 2, CY = H / 2;
  var famIndex = {};
  data.families.forEach(function (f, i) {
    // families sit on an ellipse, clockwise from the left via the top
    var a = Math.PI + i * 2 * Math.PI / data.families.length;
    f.ax = CX + 375 * Math.cos(a); f.ay = CY + 250 * Math.sin(a);
    famIndex[f.id] = f;
  });

  var byId = {};
  data.nodes.forEach(function (n, i) {
    byId[n.id] = n;
    n.nb = {}; n.edges = [];
    var f = famIndex[n.fam];
    // deterministic start near the family anchor
    var h = 0; for (var k = 0; k < n.id.length; k++) h = (h * 31 + n.id.charCodeAt(k)) % 9973;
    var ang = (h / 9973) * 2 * Math.PI, rad = 20 + (h % 50);
    n.x = (f ? f.ax : CX) + rad * Math.cos(ang); n.y = (f ? f.ay : CY) + rad * Math.sin(ang);
  });
  // the hub (type "hub") is pinned at the centre; fall back to the first node
  var core = data.nodes.filter(function (n) { return n.type === "hub"; })[0] || data.nodes[0];
  core.fx = CX; core.fy = CY;
  var links = data.links.map(function (l) {
    var s = byId[l[0]], t = byId[l[1]];
    var e = {source: s, target: t, label: l[2], paper: s.type === "paper" || t.type === "paper"};
    s.nb[t.id] = 1; t.nb[s.id] = 1; s.edges.push(e); t.edges.push(e);
    return e;
  });
  data.nodes.forEach(function (n) {
    var deg = n.edges.filter(function (e) { return !e.paper; }).length;
    n.r = n.type === "hub" ? 17 : n.type === "paper" ? 4.2 : 6 + Math.min(7, Math.sqrt(deg) * 1.9);
  });

  // ---- layout -------------------------------------------------------------
  var sim = d3.forceSimulation(data.nodes)
    .force("link", d3.forceLink(links)
      .distance(function (e) { return e.paper ? 24 : (e.source.fam === e.target.fam ? 54 : 120); })
      .strength(function (e) { return e.paper ? 0.7 : (e.source.fam === e.target.fam ? 0.32 : 0.03); }))
    .force("charge", d3.forceManyBody().strength(function (n) { return n.type === "paper" ? -26 : -190; }))
    .force("x", d3.forceX(function (n) { return n.fam ? famIndex[n.fam].ax : CX; })
      .strength(function (n) { return n.type === "paper" ? 0.03 : 0.16; }))
    .force("y", d3.forceY(function (n) { return n.fam ? famIndex[n.fam].ay : CY; })
      .strength(function (n) { return n.type === "paper" ? 0.03 : 0.16; }))
    .force("collide", d3.forceCollide(function (n) {
      return n.type === "paper" ? n.r + 4 : Math.max(n.r + 8, Math.min(72, n.label.length * 4.0));
    }).iterations(2))
    .stop();
  for (var i = 0; i < 420; i++) sim.tick();

  // ---- drawing ------------------------------------------------------------
  // the svg is sized in screen pixels; the zoom transform maps the W x H layout into it
  var VW = 1, VH = 1;
  var svg = d3.select(host).append("svg")
    .attr("role", "group").attr("aria-label", "Concept map");
  host.querySelector(".map-fallback") && host.querySelector(".map-fallback").remove();
  var layer = svg.append("g");
  // faint family names, placed outward from the centroid of each family's concepts
  var famLabels = layer.append("g").attr("class", "m-fams").selectAll("text").data(data.families).join("text")
    .attr("class", function (f) { return "m-famlabel f-" + f.id; })
    .text(function (f) { return f.label; });
  function placeFamLabels() {
    famLabels.each(function (f) {
      var ns = data.nodes.filter(function (n) { return n.fam === f.id && n.type === "concept"; });
      var mx = d3.mean(ns, function (n) { return n.x; }), my = d3.mean(ns, function (n) { return n.y; });
      var dx = mx - CX, dy = my - CY, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var far = d3.max(ns, function (n) { return ((n.x - CX) * dx + (n.y - CY) * dy) / d; });
      f.lx = CX + dx / d * (far + 34); f.ly = CY + dy / d * (far + 34);
      d3.select(this).attr("x", f.lx).attr("y", f.ly)
        .attr("text-anchor", Math.abs(dx / d) < 0.35 ? "middle" : dx > 0 ? "start" : "end");
    });
  }
  var linkSel = layer.append("g").attr("class", "m-links").selectAll("line").data(links).join("line")
    .attr("class", function (e) { return e.paper ? "m-link m-plink" : "m-link"; });
  var nodeSel = layer.append("g").attr("class", "m-nodes").selectAll("g").data(data.nodes).join("g")
    .attr("class", function (n) { return "m-node m-" + n.type + (n.fam ? " f-" + n.fam : ""); })
    .attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", function (n) { return n.label + (n.year ? " (" + n.year + ")" : ""); });
  nodeSel.append("circle").attr("r", function (n) { return n.r; });
  nodeSel.append("text")
    .attr("dy", function (n) { return n.type === "paper" ? -8 : n.r + 13; })
    .text(function (n) { return n.type === "paper" ? n.label + " · " + n.year : n.label; });

  function draw() {
    linkSel.attr("x1", function (e) { return e.source.x; }).attr("y1", function (e) { return e.source.y; })
      .attr("x2", function (e) { return e.target.x; }).attr("y2", function (e) { return e.target.y; });
    nodeSel.attr("transform", function (n) { return "translate(" + n.x + "," + n.y + ")"; });
  }
  draw();
  placeFamLabels();

  var zoom = d3.zoom().scaleExtent([0.45, 4]).on("zoom", function (ev) {
    layer.attr("transform", ev.transform);
    svg.classed("m-near", ev.transform.k > 1.55);
  });
  svg.call(zoom).on("dblclick.zoom", null);

  function fit(ids, animate) {
    var ns = ids.map(function (id) { return byId[id]; });
    // the whole-map view must include the family labels (their real boxes), or a
    // small map cuts them off at the canvas edge
    if (ids.length > 40 || ids.length === data.nodes.filter(visible).length) {
      famLabels.each(function () {
        try { var b = this.getBBox(); ns = ns.concat([{x: b.x, y: b.y}, {x: b.x + b.width, y: b.y + b.height}]); } catch (e) {}
      });
    }
    var padx = ids.length > 40 ? 150 : 70;
    var x0 = d3.min(ns, function (n) { return n.x; }) - padx, x1 = d3.max(ns, function (n) { return n.x; }) + padx;
    var y0 = d3.min(ns, function (n) { return n.y; }) - 50, y1 = d3.max(ns, function (n) { return n.y; }) + 60;
    var k = Math.min(2.4, 0.94 / Math.max((x1 - x0) / VW, (y1 - y0) / VH));
    var t = d3.zoomIdentity.translate(VW / 2, VH / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    (animate && !reduce ? svg.transition().duration(650) : svg).call(zoom.transform, t);
  }
  function fitAll(animate) { fit(data.nodes.filter(visible).map(function (n) { return n.id; }), animate); }

  // drag a node to untangle; the layout relaxes around it
  sim.on("tick", draw);
  nodeSel.call(d3.drag()
    .on("start", function (ev, n) { if (!ev.active) sim.alphaTarget(0.15).restart(); n.fx = n.x; n.fy = n.y; })
    .on("drag", function (ev, n) { n.fx = ev.x; n.fy = ev.y; })
    .on("end", function (ev, n) { if (!ev.active) sim.alphaTarget(0); if (n !== core) { n.fx = null; n.fy = null; } setTimeout(placeFamLabels, 600); }));

  // ---- highlighting -------------------------------------------------------
  var showPapers = false, selected = null, tourStep = -1, famFocus = null;
  function visible(n) { return showPapers || n.type !== "paper"; }

  function applyHighlight(set) {
    var on = !!set;
    nodeSel.classed("m-dim", function (n) { return on && !set[n.id]; })
      .classed("m-hi", function (n) { return on && !!set[n.id]; })
      .classed("m-sel", function (n) { return n.id === selected; });
    linkSel.classed("m-dim", function (e) { return on && !(set[e.source.id] && set[e.target.id]); })
      .classed("m-hi", function (e) { return on && !!(set[e.source.id] && set[e.target.id]); });
  }
  function neighbourhood(id) {
    var s = {}; s[id] = 1; Object.keys(byId[id].nb).forEach(function (k) { s[k] = 1; }); return s;
  }
  function baseSet() {
    if (selected) return neighbourhood(selected);
    if (tourStep >= 0) { var s = {}; data.tour[tourStep].nodes.forEach(function (k) { s[k] = 1; }); return s; }
    if (famFocus) { var f = {}; data.nodes.forEach(function (n) { if (n.fam === famFocus) f[n.id] = 1; }); return f; }
    return null;
  }
  nodeSel.on("mouseenter", function (ev, n) { applyHighlight(neighbourhood(n.id)); })
    .on("mouseleave", function () { applyHighlight(baseSet()); })
    .on("click", function (ev, n) { ev.stopPropagation(); select(n.id, false); })
    .on("keydown", function (ev, n) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select(n.id, true); } });
  svg.on("click", function () { if (selected) { selected = null; render(); } });

  // ---- panel ---------------------------------------------------------------
  var panel = document.getElementById("mapPanel");
  var stepLabel = document.getElementById("tourLabel");
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); }
  function chip(id) {
    var n = byId[id];
    return '<button type="button" class="m-chip ' + (n.fam ? "f-" + n.fam : "f-hub") + '" data-node="' + id + '">' + esc(n.label) + "</button>";
  }
  function deeper(list) {
    if (!list || !list.length) return "";
    return '<p class="mp-k">Go deeper in this book</p><ul class="mp-deep">' + list.map(function (c) {
      return '<li><a href="#' + c + '">' + c.toUpperCase().replace(/^([A-Z])0*/, "$1") + " · " + esc(chapters[c] || c) + "</a></li>";
    }).join("") + "</ul>";
  }

  function renderNode(n) {
    var fam = n.fam ? famIndex[n.fam].label : "Hub";
    var h = '<p class="mp-k"><span class="m-dot ' + (n.fam ? "f-" + n.fam : "f-hub") + '"></span>' +
      (n.type === "paper" ? "Key work · " + n.year : n.type === "hub" ? "Start here" : "Concept") + " · " + esc(fam) + "</p>";
    h += "<h3>" + esc(n.label) + "</h3>";
    if (n.who) h += '<p class="mp-who">' + esc(n.who) + ", " + n.year + "</p>";
    h += '<p class="mp-blurb">' + esc(n.blurb) + "</p>";
    if (n.url) h += '<p><a href="' + n.url + '" target="_blank" rel="noopener">Open ↗</a></p>';
    var concept = n.edges.filter(function (e) { return !e.paper; });
    var papers = n.edges.filter(function (e) { return e.paper; });
    if (concept.length) {
      h += '<p class="mp-k">Connects to</p><ul class="mp-edges">' + concept.map(function (e) {
        var out = e.source === n, other = out ? e.target : e.source;
        return "<li><span class=\"mp-arrow\">" + (out ? "→" : "←") + "</span>" + chip(other.id) +
          '<span class="mp-rel">' + esc(out ? e.label : e.label) + "</span></li>";
      }).join("") + "</ul>";
    }
    if (papers.length) {
      var ps = papers.map(function (e) { return e.source === n ? e.target : e.source; });
      if (n.type === "paper") {
        h += '<p class="mp-k">' + (papers.some(function (e) { return e.label === "introduces"; }) ? "Introduces or shapes" : "Related") + "</p><p>" + ps.map(function (p) { return chip(p.id); }).join(" ") + "</p>";
      } else {
        ps.sort(function (a, b) { return a.year - b.year; });
        h += '<p class="mp-k">Works everyone should know</p><ul class="mp-papers">' + ps.map(function (p) {
          return '<li><span class="mp-year">' + p.year + '</span><span><a href="' + p.url + '" target="_blank" rel="noopener">' +
            esc(p.label) + "</a> <span class=\"mp-who\">" + esc(p.who) + "</span><br><span class=\"mp-pb\">" + esc(p.blurb) + "</span></span></li>";
        }).join("") + "</ul>";
      }
    }
    h += deeper(n.deeper);
    return h;
  }
  function renderTour(i) {
    var s = data.tour[i];
    return '<p class="mp-k">The big picture · ' + (i + 1) + " of " + data.tour.length + "</p><h3>" + esc(s.title) + "</h3>" +
      '<p class="mp-blurb">' + esc(s.text) + '</p><p class="mp-k">On the map</p><p class="mp-chips">' +
      s.nodes.map(chip).join(" ") + "</p>";
  }
  function renderIntro() {
    return '<p class="mp-k">How to use the map</p><h3>Zoom out first</h3><p class="mp-blurb">Each dot is a concept, coloured by family. Switch on Papers to add the landmark works as small rings. Lines say how ideas relate. Hover to see a node\'s neighbours, click for a short summary, its links and its key works, then follow "Go deeper" into a chapter. Drag to pan, scroll or pinch to zoom.</p>' +
      '<p class="mp-k">Or take the tour, in ' + data.tour.length + ' steps</p><ol class="mp-tour">' + data.tour.map(function (s, i) {
        return '<li><button type="button" class="m-link-btn" data-step="' + i + '">' + esc(s.title) + "</button></li>";
      }).join("") + "</ol>";
  }

  function render() {
    if (selected) panel.innerHTML = renderNode(byId[selected]);
    else if (tourStep >= 0) panel.innerHTML = renderTour(tourStep);
    else panel.innerHTML = renderIntro();
    stepLabel.textContent = tourStep >= 0 ? (tourStep + 1) + " / " + data.tour.length + " · " + data.tour[tourStep].title : "Tour: " + data.tour.length + " steps";
    applyHighlight(baseSet());
  }

  function select(id, center) {
    selected = id; render();
    if (center) fit(Object.keys(neighbourhood(id)), true);
    panel.scrollTop = 0;
  }
  function goStep(i) {
    tourStep = Math.max(0, Math.min(data.tour.length - 1, i)); selected = null; famFocus = null;
    render(); fit(data.tour[tourStep].nodes, true);
  }

  panel.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-node]");
    if (b) { select(b.dataset.node, true); return; }
    var s = ev.target.closest("[data-step]");
    if (s) goStep(+s.dataset.step);
  });
  document.getElementById("tourPrev").addEventListener("click", function () { goStep(tourStep < 0 ? 0 : tourStep - 1); });
  document.getElementById("tourNext").addEventListener("click", function () { goStep(tourStep + 1); });
  document.getElementById("mapReset").addEventListener("click", function () {
    selected = null; tourStep = -1; famFocus = null; render(); fitAll(true);
  });
  var papersBtn = document.getElementById("mapPapers");
  papersBtn.addEventListener("click", function () {
    showPapers = !showPapers; applyPapers();
  });

  // family chips in the legend focus one family
  document.querySelectorAll(".m-fam").forEach(function (b) {
    b.addEventListener("click", function () {
      var f = b.dataset.fam;
      famFocus = famFocus === f ? null : f; selected = null; tourStep = -1;
      document.querySelectorAll(".m-fam").forEach(function (x) { x.setAttribute("aria-pressed", x.dataset.fam === famFocus ? "true" : "false"); });
      render();
      if (famFocus) fit(data.nodes.filter(function (n) { return n.fam === famFocus; }).map(function (n) { return n.id; }), true);
      else fitAll(true);
    });
  });

  // search
  var search = document.getElementById("mapSearch");
  search.addEventListener("change", function () {
    var q = search.value.trim().toLowerCase(); if (!q) return;
    var hit = data.nodes.find(function (n) { return n.label.toLowerCase() === q; }) ||
      data.nodes.find(function (n) { return n.label.toLowerCase().indexOf(q) >= 0; });
    if (hit) { if (hit.type === "paper" && !showPapers) papersBtn.click(); select(hit.id, true); }
  });

  // index below the map selects nodes too
  document.querySelectorAll(".map-index [data-node]").forEach(function (b) {
    b.addEventListener("click", function () {
      select(b.dataset.node, true);
      document.getElementById("map").scrollIntoView({behavior: reduce ? "auto" : "smooth", block: "start"});
    });
  });

  function measure() {
    VW = host.clientWidth || 800; VH = host.clientHeight || 560;
    svg.attr("viewBox", "0 0 " + VW + " " + VH);
  }
  var lastW = 0;
  new ResizeObserver(function () {
    if (Math.abs(host.clientWidth - lastW) < 2) return;
    lastW = host.clientWidth; measure();
    if (tourStep >= 0) fit(data.tour[tourStep].nodes, false);
    else if (selected) fit(Object.keys(neighbourhood(selected)), false);
    else fitAll(false);
  }).observe(host);

  function applyPapers() {
    papersBtn.setAttribute("aria-pressed", showPapers ? "true" : "false");
    nodeSel.style("display", function (n) { return visible(n) ? null : "none"; });
    linkSel.style("display", function (e) { return e.paper && !showPapers ? "none" : null; });
  }
  applyPapers();
  measure();
  render();
  fitAll(false);
})();
