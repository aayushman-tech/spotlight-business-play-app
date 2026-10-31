// charts.js - renders exhibits (tables, bar/line charts, KPI tiles) as SVG/DOM.
// Every text string is inserted with textContent - story text is NEVER trusted as markup.

const SVG_NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}, text = null) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) node.setAttribute(k, String(v));
  }
  if (text != null) node.textContent = text;
  return node;
}

function svgEl(tag, attrs = {}, text = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) node.setAttribute(k, String(v));
  }
  if (text != null) node.textContent = text;
  return node;
}

export function renderExhibit(ex) {
  switch (ex.type) {
    case "table": return renderTable(ex);
    case "bar_chart": return renderBarChart(ex);
    case "line_chart": return renderLineChart(ex);
    case "kpi": return renderKpi(ex);
    default: return null;
  }
}

function renderTable(ex) {
  const wrap = el("div", { class: "exhibit" });
  wrap.appendChild(el("h3", {}, ex.title));
  const table = el("table", { class: "data-table", role: "table" });
  const thead = el("thead");
  const hr = el("tr");
  (ex.columns || []).forEach((c) => hr.appendChild(el("th", { scope: "col" }, c)));
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = el("tbody");
  for (const row of ex.rows || []) {
    const tr = el("tr");
    row.forEach((cell, i) => tr.appendChild(el(i === 0 ? "th" : "td",
      i === 0 ? { scope: "row", style: null } : {}, cell)));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function renderKpi(ex) {
  const wrap = el("div", { class: "exhibit" });
  if (ex.title) wrap.appendChild(el("h3", {}, ex.title));
  const grid = el("div", { class: "kpi-grid" });
  for (const item of ex.items || []) {
    const tile = el("div", { class: "kpi-tile" });
    tile.appendChild(el("div", { class: "l" }, item.label));
    tile.appendChild(el("div", { class: "v" }, item.value));
    if (item.delta) {
      const dir = item.delta.trim().startsWith("+") || item.delta.trim().startsWith("↑") ? "up" : "down";
      tile.appendChild(el("div", { class: "d", "data-dir": dir }, item.delta));
    }
    grid.appendChild(tile);
  }
  wrap.appendChild(grid);
  return wrap;
}

function renderBarChart(ex) {
  const wrap = el("div", { class: "exhibit" });
  wrap.appendChild(el("h3", {}, ex.title));
  const data = ex.data || [];
  const W = 520;
  const rowH = 30;
  const labelW = 110;
  const H = data.length * rowH + 30;
  const max = Math.max(...data.map((d) => Math.abs(Number(d.value) || 0)), 1);

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img",
    "aria-label": `${ex.title}. ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`,
  });
  // horizontal gridline max
  svg.appendChild(svgEl("line", {
    x1: labelW, y1: 0, x2: labelW, y2: H - 22,
    class: "gridline", "stroke-width": 1, "vector-effect": "non-scaling-stroke",
  }));
  data.forEach((d, i) => {
    const y = i * rowH + 8;
    const w = Math.max(2, ((Math.abs(Number(d.value)) || 0) / max) * (W - labelW - 70));
    svg.appendChild(svgEl("text", { x: 0, y: y + 14, fill: "currentColor", "font-size": 12 }, `${d.label}`));
    svg.appendChild(svgEl("rect", {
      x: labelW, y, width: w, height: 16, rx: 3, class: "bar-rect",
      fill: "var(--accent)", "data-label": d.label,
    }));
    svg.appendChild(svgEl("text", {
      x: labelW + w + 8, y: y + 14, fill: "currentColor", "font-size": 12, "font-weight": 700,
    }, `${formatNum(d.value)}${ex.unit ? " " + ex.unit : ""}`));
  });
  wrap.appendChild(svg);
  return wrap;
}

function renderLineChart(ex) {
  const wrap = el("div", { class: "exhibit" });
  wrap.appendChild(el("h3", {}, ex.title));
  const data = ex.data || [];
  const W = 520, H = 200, padL = 46, padB = 26, padT = 12;
  const max = Math.max(...data.map((d) => Number(d.value) || 0), 0.000001);
  const min = Math.min(...data.map((d) => Number(d.value) || 0), 0);
  const range = max - min || 1;
  const x = (i) => padL + (i * (W - padL - 14)) / Math.max(data.length - 1, 1);
  const y = (v) => padT + (1 - (v - min) / range) * (H - padT - padB);

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img",
    "aria-label": `${ex.title}. ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`,
  });
  // baseline + top gridline
  svg.appendChild(svgEl("line", {
    x1: padL, y1: y(min), x2: W - 8, y2: y(min),
    "stroke": "var(--line)", "stroke-width": 1, "vector-effect": "non-scaling-stroke",
  }));
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  svg.appendChild(svgEl("polyline", {
    points: pts, fill: "none", stroke: "var(--accent)", "stroke-width": 2.5,
    "stroke-linejoin": "round", "stroke-linecap": "round", "vector-effect": "non-scaling-stroke",
  }));
  data.forEach((d, i) => {
    svg.appendChild(svgEl("circle", { cx: x(i), cy: y(d.value), r: 4, fill: "var(--accent)" }));
    svg.appendChild(svgEl("text", {
      x: x(i), y: y(d.value) - 9, fill: "currentColor", "font-size": 11, "font-weight": 700,
      "text-anchor": "middle",
    }, `${formatNum(d.value)}${ex.unit ? "" : ""}`));
    svg.appendChild(svgEl("text", {
      x: x(i), y: H - 8, fill: "currentColor", "font-size": 11, "text-anchor": "middle",
    }, d.label));
  });
  if (ex.unit) {
    svg.appendChild(svgEl("text", {
      x: 4, y: padT + 4, fill: "currentColor", "font-size": 11, opacity: .7,
    }, ex.unit));
  }
  wrap.appendChild(svg);
  return wrap;
}

function formatNum(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  if (Math.abs(num) >= 1000) return num.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return String(Math.round(num * 100) / 100);
}
