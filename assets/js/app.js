const PHIL_ORDER = ["Render-and-Decode", "Latent-Only", "Video-Generation-Free"];
const SUB_ORDER = ["Pixel-grounded", "Feature", "Geometric", "Affordance"];
const FILTER_KEYS = ["philosophy", "substrateGroup", "backbone", "coupling", "deployment"];
const SORTS = ["recent", "citations", "oldest", "title"];
const URL_KEYS = { philosophy: "p", substrateGroup: "sg", backbone: "bb", coupling: "cp", deployment: "dp" };

const state = {
  papers: [],
  search: "",
  sort: "recent",
  density: "comfortable",
  filters: {
    philosophy: new Set(),
    substrateGroup: new Set(),
    backbone: new Set(),
    coupling: new Set(),
    deployment: new Set(),
  },
};

const $ = (sel) => document.querySelector(sel);
const selectors = {
  search: $("#paper-search"),
  searchClear: $("#search-clear"),
  sort: $("#paper-sort"),
  list: $("#paper-list"),
  resultCount: $("#result-count"),
  metadataDate: $("#metadata-date"),
  matrix: $("#taxonomy-matrix"),
  toolbar: $("#toolbar"),
  clear: $("#clear-filters"),
  chips: $("#active-chips"),
  filterPanel: $("#filter-panel"),
  filtersOpen: $("#filters-open"),
  filtersClose: $("#filters-close"),
  filtersCount: $("#filters-count"),
  backdrop: $("#sheet-backdrop"),
  density: $("#density-toggle"),
  timeline: $("#timeline-plot"),
};

const matrixCompact = window.matchMedia("(max-width: 36rem)");
const railMode = window.matchMedia("(min-width: 60rem)");
const cardMap = new Map();
let emptyNode = null;
let searchTimer = null;

/* ---------- helpers ---------- */

function el(tag, attrs = {}, html) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  if (html != null) node.innerHTML = html;
  return node;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function number(value) {
  return new Intl.NumberFormat("en").format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatUpdate(value) {
  if (!value) return "Not updated yet";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function substrateGroups(substrate) {
  const groups = new Set();
  if (/Pixel|Audio/i.test(substrate)) groups.add("Pixel-grounded");
  if (/Feature/i.test(substrate)) groups.add("Feature");
  if (/Geometric/i.test(substrate)) groups.add("Geometric");
  if (/Affordance/i.test(substrate)) groups.add("Affordance");
  return [...groups];
}

function uniqueValues(key) {
  return [...new Set(state.papers.map((p) => p[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function groupHasValue(paper, key, value) {
  return key === "substrateGroup" ? paper.substrateGroups.includes(value) : paper[key] === value;
}

function matchValueInSet(paper, key, set) {
  if (!set.size) return true;
  if (key === "substrateGroup") return paper.substrateGroups.some((g) => set.has(g));
  return set.has(paper[key]);
}

function searchMatch(paper) {
  if (!state.search) return true;
  const text = [
    paper.shortName, paper.title, paper.philosophy, paper.substrate,
    paper.backbone, paper.coupling, paper.deployment, paper.backboneDetail, paper.tldr,
  ].join(" ").toLowerCase();
  return text.includes(state.search.toLowerCase());
}

function matchesBase(paper, exceptKeys = []) {
  if (!searchMatch(paper)) return false;
  return FILTER_KEYS.every((k) => exceptKeys.includes(k) || matchValueInSet(paper, k, state.filters[k]));
}

function matchesAll(paper) {
  return matchesBase(paper, []);
}

function sortedPapers(papers) {
  const copy = [...papers];
  if (state.sort === "citations") {
    copy.sort((a, b) => b.citationCount - a.citationCount || b.firstVersionDate.localeCompare(a.firstVersionDate));
  } else if (state.sort === "oldest") {
    copy.sort((a, b) => a.firstVersionDate.localeCompare(b.firstVersionDate));
  } else if (state.sort === "title") {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    copy.sort((a, b) => b.firstVersionDate.localeCompare(a.firstVersionDate) || b.citationCount - a.citationCount);
  }
  return copy;
}

function toggleSet(key, value) {
  const set = state.filters[key];
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

/* ---------- matrix (faceted heatmap) ---------- */

function computeMatrix() {
  // STATIC: always over all 112 papers, so the canonical counts never shift under other filters.
  const base = state.papers;
  const cells = {};
  const philTotal = {};
  const subTotal = {};
  PHIL_ORDER.forEach((ph) => {
    cells[ph] = {};
    philTotal[ph] = 0;
    SUB_ORDER.forEach((sub) => (cells[ph][sub] = 0));
  });
  SUB_ORDER.forEach((sub) => (subTotal[sub] = 0));

  let overlap = 0;
  base.forEach((p) => {
    if (cells[p.philosophy]) {
      philTotal[p.philosophy] += 1;
      p.substrateGroups.forEach((g) => {
        if (cells[p.philosophy][g] !== undefined) cells[p.philosophy][g] += 1;
      });
    }
    p.substrateGroups.forEach((g) => {
      if (subTotal[g] !== undefined) subTotal[g] += 1;
    });
    if (p.substrateGroups.length > 1) overlap += 1;
  });

  let max = 0;
  PHIL_ORDER.forEach((ph) => SUB_ORDER.forEach((sub) => (max = Math.max(max, cells[ph][sub]))));
  const philMax = Math.max(...PHIL_ORDER.map((ph) => philTotal[ph]), 1);
  const subMax = Math.max(...SUB_ORDER.map((sub) => subTotal[sub]), 1);
  return { cells, philTotal, subTotal, N: base.length, max, philMax, subMax, overlap };
}

function cellButton(ph, sub, count, max, withLabel) {
  const t = max ? Math.round((count / max) * 100) : 0;
  const pressed = state.filters.philosophy.has(ph) && state.filters.substrateGroup.has(sub);
  const b = el("button", {
    class: "m-cell" + (t > 55 ? " is-hot" : ""),
    type: "button",
    "data-ph": ph,
    "data-sub": sub,
    "data-act": "cell",
    "aria-pressed": String(pressed),
    "aria-label": `${ph} and ${sub}: ${count} papers`,
    style: `--t:${t}`,
  });
  if (count === 0) b.setAttribute("aria-disabled", "true");
  b.innerHTML = (withLabel ? `<span class="m-sublabel">${escapeHtml(sub)}</span>` : "") + `<span class="m-count">${count}</span>`;
  return b;
}

// Clickable axis label: shows the group's distinct size as a DIFFERENT primitive (muted number + under-bar),
// so it never reads as the sum of a row/column of heat cells.
function axisHead(act, name, total, axisMax) {
  const pressed = act === "row" ? state.filters.philosophy.has(name) : state.filters.substrateGroup.has(name);
  const w = axisMax ? Math.round((total / axisMax) * 100) : 0;
  const attrs = {
    class: act === "row" ? "m-rowhead" : "m-colhead",
    type: "button",
    "data-act": act,
    "aria-pressed": String(pressed),
    "aria-label": `${name}: ${total} papers — toggle filter`,
  };
  attrs[act === "row" ? "data-ph" : "data-sub"] = name;
  const b = el("button", attrs);
  b.innerHTML =
    `<span class="m-axis-name">${escapeHtml(name)}</span>` +
    `<span class="m-axis-size"><span class="m-axis-num">${total}</span>` +
    `<span class="m-axis-bar" style="--w:${w}%"></span></span>`;
  return b;
}

function matrixCaption(data) {
  const philList = PHIL_ORDER.map((ph) => data.philTotal[ph]).join(" / ");
  const subList = SUB_ORDER.map((sub) => data.subTotal[sub]).join(" / ");
  const cap = el("div", { class: "matrix-cap" });
  cap.innerHTML =
    `<div class="m-legend" aria-hidden="true">` +
      `<span class="m-legend-lo">fewer</span>` +
      `<span class="m-legend-track"></span>` +
      `<span class="m-legend-hi">more (${data.max})</span></div>` +
    `<p class="matrix-note">Cells count papers per philosophy × substrate. ` +
      `Each paper has one design philosophy, so the philosophy sizes (${philList}) sum to ${data.N}. ` +
      `${data.overlap} papers use two substrates and are counted under both, so the substrate sizes (${subList}) ` +
      `overlap by design and a philosophy's cells can total more than its size.</p>` +
    `<p class="matrix-total"><strong>${data.N}</strong> papers total</p>`;
  return cap;
}

function restoreMatrixFocus(refocus) {
  if (!refocus || !refocus.act) return;
  let sel = `[data-act="${refocus.act}"]`;
  if (refocus.ph) sel += `[data-ph="${refocus.ph}"]`;
  if (refocus.sub) sel += `[data-sub="${refocus.sub}"]`;
  const target = selectors.matrix.querySelector(sel);
  if (target) target.focus();
}

function renderMatrix() {
  selectors.matrix.setAttribute("role", "group");
  const data = computeMatrix();
  const active = document.activeElement;
  const refocus = active && selectors.matrix.contains(active)
    ? { act: active.dataset.act, ph: active.dataset.ph, sub: active.dataset.sub }
    : null;
  selectors.matrix.innerHTML = "";

  if (matrixCompact.matches) {
    selectors.matrix.className = "matrix is-stacked";
    PHIL_ORDER.forEach((ph) => {
      const block = el("div", { class: "m-block" });
      const head = el("button", {
        class: "m-block-head",
        type: "button",
        "data-ph": ph,
        "data-act": "row",
        "aria-pressed": String(state.filters.philosophy.has(ph)),
      });
      const w = Math.round((data.philTotal[ph] / data.philMax) * 100);
      head.append(el("span", { class: "m-block-name", text: ph }));
      const size = el("span", { class: "m-axis-size" });
      size.innerHTML = `<span class="m-axis-num">${data.philTotal[ph]}</span><span class="m-axis-bar" style="--w:${w}%"></span>`;
      head.append(size);
      block.append(head);
      const grid = el("div", { class: "m-block-grid" });
      SUB_ORDER.forEach((sub) => grid.append(cellButton(ph, sub, data.cells[ph][sub], data.max, true)));
      block.append(grid);
      selectors.matrix.append(block);
    });
    const foot = el("div", { class: "m-foot" });
    foot.innerHTML =
      `<span class="m-foot-label">substrate reach</span>` +
      SUB_ORDER.map((sub) => `<span>${sub} <strong>${data.subTotal[sub]}</strong></span>`).join("");
    selectors.matrix.append(foot);
    selectors.matrix.append(matrixCaption(data));
    restoreMatrixFocus(refocus);
    return;
  }

  selectors.matrix.className = "matrix is-table";
  selectors.matrix.append(el("div", { class: "m-corner" }, ""));
  SUB_ORDER.forEach((sub) => selectors.matrix.append(axisHead("col", sub, data.subTotal[sub], data.subMax)));
  PHIL_ORDER.forEach((ph) => {
    selectors.matrix.append(axisHead("row", ph, data.philTotal[ph], data.philMax));
    SUB_ORDER.forEach((sub) => selectors.matrix.append(cellButton(ph, sub, data.cells[ph][sub], data.max, false)));
  });
  selectors.matrix.append(matrixCaption(data));
  restoreMatrixFocus(refocus);
}

/* ---------- filters (faceted counts, built once) ---------- */

function buildFilters() {
  FILTER_KEYS.forEach((key) => {
    const container = document.querySelector(`[data-filter-group="${key}"]`);
    const values = key === "philosophy" ? PHIL_ORDER : key === "substrateGroup" ? SUB_ORDER : uniqueValues(key);
    container.innerHTML = "";
    values.forEach((v) => {
      const b = el("button", { type: "button", "data-group": key, "data-value": v, "aria-pressed": "false" });
      b.innerHTML = `<span class="opt-text"></span><span class="opt-count"></span>`;
      b.querySelector(".opt-text").textContent = v;
      container.append(b);
    });
  });
}

function updateFilters() {
  FILTER_KEYS.forEach((key) => {
    const base = state.papers.filter((p) => matchesBase(p, [key]));
    const container = document.querySelector(`[data-filter-group="${key}"]`);
    container.querySelectorAll("button").forEach((b) => {
      const v = b.dataset.value;
      const pressed = state.filters[key].has(v);
      const count = base.reduce((a, p) => a + (groupHasValue(p, key, v) ? 1 : 0), 0);
      b.setAttribute("aria-pressed", String(pressed));
      b.querySelector(".opt-count").textContent = count;
      b.disabled = count === 0 && !pressed;
      if (count === 0 && !pressed) b.title = "0 with current filters";
      else b.removeAttribute("title");
    });
  });
}

function buildDensity() {
  selectors.density.innerHTML = "";
  [["comfortable", "Comfortable"], ["compact", "Compact"]].forEach(([v, label]) => {
    selectors.density.append(
      el("button", { type: "button", "data-density": v, "aria-pressed": String(state.density === v), text: label }),
    );
  });
}

function updateDensityButtons() {
  selectors.density.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.density === state.density));
  });
}

function applyDensity() {
  document.body.dataset.density = state.density;
}

/* ---------- active chips ---------- */

function chip(key, value, label) {
  const b = el("button", {
    type: "button",
    class: "chip",
    "data-chip-key": key,
    "data-chip-val": value ?? "",
    "aria-label": `Remove filter ${label}`,
  });
  b.innerHTML = `<span class="chip-text"></span><span class="chip-x" aria-hidden="true">×</span>`;
  b.querySelector(".chip-text").textContent = label;
  return b;
}

function renderChips() {
  selectors.chips.innerHTML = "";
  if (state.search) selectors.chips.append(chip("search", null, `“${state.search}”`));
  FILTER_KEYS.forEach((key) => state.filters[key].forEach((v) => selectors.chips.append(chip(key, v, v))));
}

/* ---------- list ---------- */

function highlighted(raw, term) {
  if (!term) return escapeHtml(raw);
  const lower = raw.toLowerCase();
  const t = term.toLowerCase();
  let out = "";
  let i = 0;
  let idx;
  while ((idx = lower.indexOf(t, i)) !== -1) {
    out += escapeHtml(raw.slice(i, idx)) + "<mark>" + escapeHtml(raw.slice(idx, idx + t.length)) + "</mark>";
    i = idx + t.length;
  }
  return out + escapeHtml(raw.slice(i));
}

function highlightCard(node, term) {
  const name = node.querySelector(".js-name");
  const title = node.querySelector(".js-title");
  const tldr = node.querySelector(".js-tldr");
  name.innerHTML = highlighted(node.dataset.name, term);
  title.innerHTML = highlighted(node.dataset.title, term);
  tldr.innerHTML = highlighted(node.dataset.tldr, term);
  // also highlight matching taxonomy tags so tag-only matches show why the card matched
  node.querySelectorAll(".paper-tags .tag").forEach((tag) => {
    const raw = tag.dataset.raw || tag.textContent;
    tag.dataset.raw = raw;
    tag.innerHTML = highlighted(raw, term);
  });
}

function cardNode(p) {
  const philosophyClass = `philosophy-${slug(p.philosophy)}`;
  const citationTitle = `${p.citationSource || "citation source"} · updated ${formatUpdate(p.citationUpdatedAt)}`;
  const tldr = p.tldr || p.backboneDetail || "Survey paper entry.";
  const art = el("article", { class: "paper-card" });
  art.dataset.id = p.id;
  art.dataset.name = p.shortName || "";
  art.dataset.title = p.title || "";
  art.dataset.tldr = tldr;
  art.innerHTML = `
    <div class="paper-top">
      <h3 class="js-name">${escapeHtml(p.shortName)}</h3>
      <a class="arxiv-link" href="${escapeHtml(p.arxivUrl)}" target="_blank" rel="noopener">arXiv ${escapeHtml(p.arxivId)} <span aria-hidden="true">↗</span></a>
    </div>
    <div class="paper-title js-title">${escapeHtml(p.title)}</div>
    <div class="paper-tags">
      <span class="tag ${philosophyClass}">${escapeHtml(p.philosophy)}</span>
      <span class="tag">${escapeHtml((p.substrate || "").replace(/\s*∧\s*/g, " & "))}</span>
      <span class="tag">${escapeHtml(p.backbone)}</span>
      <span class="tag">${escapeHtml(p.coupling)}</span>
      <span class="tag">${escapeHtml(p.deployment)}</span>
    </div>
    <p class="paper-summary js-tldr">${escapeHtml(tldr)}</p>
    <div class="paper-bottom">
      <span class="backbone-detail">${escapeHtml(p.backboneDetail)}</span>
    </div>
    <div class="paper-meta">
      <span class="meta-chip citations" title="${escapeHtml(citationTitle)}">${number(p.citationCount)} citations</span>
      <span class="meta-chip date">First arXiv: ${formatDate(p.firstVersionDate)}</span>
      <span class="meta-chip source">${escapeHtml(p.citationSource || "not indexed")}</span>
    </div>`;
  return art;
}

function buildCards() {
  cardMap.clear();
  selectors.list.innerHTML = "";
  const frag = document.createDocumentFragment();
  state.papers.forEach((p) => {
    const node = cardNode(p);
    cardMap.set(p.id, node);
    frag.append(node);
  });
  selectors.list.append(frag);
}

function toggleEmpty(isEmpty) {
  if (isEmpty) {
    if (!emptyNode) {
      emptyNode = el("div", { class: "state-card" }, `<strong>0 papers</strong>`);
      const btn = el("button", { type: "button", text: "Clear filters" });
      btn.addEventListener("click", clearAll);
      emptyNode.append(btn);
    }
    if (!emptyNode.isConnected) selectors.list.after(emptyNode);
    selectors.list.hidden = true;
  } else {
    if (emptyNode && emptyNode.isConnected) emptyNode.remove();
    selectors.list.hidden = false;
  }
}

function renderList() {
  const filtered = sortedPapers(state.papers.filter(matchesAll));
  const visible = new Set();
  const frag = document.createDocumentFragment();
  filtered.forEach((p) => {
    const node = cardMap.get(p.id);
    if (!node) return;
    node.hidden = false;
    highlightCard(node, state.search);
    frag.append(node);
    visible.add(p.id);
  });
  cardMap.forEach((node, id) => {
    if (!visible.has(id)) node.hidden = true;
  });
  selectors.list.append(frag);
  toggleEmpty(filtered.length === 0);
  selectors.resultCount.textContent = `${number(filtered.length)} ${filtered.length === 1 ? "paper" : "papers"}`;
  layoutMasonry();
}

/* true masonry: place each card (in sorted order) into the currently shortest
   column, so cards keep their natural height and pack tightly while the top row
   still reads left-to-right in sort order */
function layoutMasonry() {
  const list = selectors.list;
  if (!list || list.hidden) return;
  const total = list.clientWidth;
  if (!total) return;
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--space-sm")) || 12;
  const colMin = 18 * rootPx;
  const cols = Math.max(1, Math.floor((total + gap) / (colMin + gap)));
  const colWidth = (total - (cols - 1) * gap) / cols;
  const cards = [];
  for (const node of list.children) {
    if (node.nodeType === 1 && !node.hidden && node.classList.contains("paper-card")) {
      node.style.width = `${colWidth}px`;
      cards.push(node);
    }
  }
  const colH = new Array(cols).fill(0);
  for (const card of cards) {
    let c = 0;
    for (let i = 1; i < cols; i++) {
      if (colH[i] < colH[c] - 0.5) c = i;
    }
    const x = Math.round(c * (colWidth + gap));
    const y = Math.round(colH[c]);
    card.style.transform = `translate(${x}px, ${y}px)`;
    colH[c] += card.offsetHeight + gap;
  }
  list.style.height = cards.length ? `${Math.max(...colH) - gap}px` : "";
}

/* ---------- toolbar ---------- */

function updateToolbar() {
  const n = FILTER_KEYS.reduce((a, k) => a + state.filters[k].size, 0);
  selectors.filtersCount.textContent = n;
  selectors.filtersCount.hidden = n === 0;
  selectors.searchClear.hidden = !state.search;
}

/* ---------- URL state ---------- */

function setStateFromURL() {
  FILTER_KEYS.forEach((k) => state.filters[k].clear());
  const p = new URLSearchParams(location.search);
  state.search = p.get("q") || "";
  state.sort = SORTS.includes(p.get("s")) ? p.get("s") : "recent";
  Object.entries(URL_KEYS).forEach(([key, param]) => {
    const v = p.get(param);
    if (v) v.split(",").filter(Boolean).forEach((x) => state.filters[key].add(x));
  });
}

function writeURL() {
  const p = new URLSearchParams();
  if (state.search) p.set("q", state.search);
  if (state.sort !== "recent") p.set("s", state.sort);
  Object.entries(URL_KEYS).forEach(([key, param]) => {
    if (state.filters[key].size) p.set(param, [...state.filters[key]].join(","));
  });
  const qs = p.toString();
  history.replaceState(null, "", (qs ? `?${qs}` : location.pathname) + location.hash);
}

function reflectControls() {
  selectors.search.value = state.search;
  selectors.sort.value = state.sort;
  updateDensityButtons();
}

/* ---------- sync ---------- */

// matrix counts are static (computed over all papers), so only refresh selection state on sync
function updateMatrixPressed() {
  selectors.matrix.querySelectorAll("[data-act]").forEach((b) => {
    const act = b.dataset.act;
    let pressed = false;
    if (act === "cell") pressed = state.filters.philosophy.has(b.dataset.ph) && state.filters.substrateGroup.has(b.dataset.sub);
    else if (act === "row") pressed = state.filters.philosophy.has(b.dataset.ph);
    else if (act === "col") pressed = state.filters.substrateGroup.has(b.dataset.sub);
    b.setAttribute("aria-pressed", String(pressed));
  });
}

function sync() {
  updateFilters();
  updateMatrixPressed();
  renderChips();
  renderList();
  updateToolbar();
  writeURL();
}

function clearAll() {
  clearTimeout(searchTimer);
  state.search = "";
  selectors.search.value = "";
  FILTER_KEYS.forEach((k) => state.filters[k].clear());
  sync();
}

/* ---------- mobile filter sheet ---------- */

function focusables(container) {
  return [...container.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])')]
    .filter((e) => !e.disabled && e.getClientRects().length);
}

function sheetKeydown(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeSheet();
    return;
  }
  if (e.key !== "Tab") return;
  const f = focusables(selectors.filterPanel);
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function openSheet() {
  if (railMode.matches) return;
  document.body.classList.add("filters-open");
  document.body.style.overflow = "hidden";
  selectors.backdrop.hidden = false;
  selectors.filtersOpen.setAttribute("aria-expanded", "true");
  selectors.filterPanel.setAttribute("role", "dialog");
  selectors.filterPanel.setAttribute("aria-modal", "true");
  document.addEventListener("keydown", sheetKeydown, true);
  requestAnimationFrame(() => {
    (selectors.filtersClose || focusables(selectors.filterPanel)[0])?.focus();
  });
}

function closeSheet(restoreFocus = true) {
  if (!document.body.classList.contains("filters-open")) return;
  document.body.classList.remove("filters-open");
  document.body.style.overflow = "";
  selectors.backdrop.hidden = true;
  selectors.filtersOpen.setAttribute("aria-expanded", "false");
  selectors.filterPanel.removeAttribute("aria-modal");
  selectors.filterPanel.removeAttribute("role");
  document.removeEventListener("keydown", sheetKeydown, true);
  if (restoreFocus) selectors.filtersOpen.focus();
}

/* ---------- timeline (data-driven, code-native) ---------- */

function renderTimeline() {
  const host = selectors.timeline;
  if (!host) return;
  const dated = state.papers.filter((p) => p.firstVersionDate);
  if (!dated.length) return;
  const t = (p) => new Date(`${p.firstVersionDate}T00:00:00Z`).getTime();
  const min = Math.min(...dated.map(t));
  const max = Math.max(...dated.map(t));
  const span = Math.max(1, max - min);
  const xOf = (ms) => ((ms - min) / span) * 100;

  host.innerHTML = "";

  // year gridlines (behind lanes)
  const grid = el("div", { class: "tl-grid" });
  const startYear = new Date(min).getUTCFullYear();
  const endYear = new Date(max).getUTCFullYear();

  // screen-reader summary of the whole chart (instead of a generic "timeline" label)
  const laneSummary = PHIL_ORDER.map((ph) => `${ph} ${dated.filter((p) => p.philosophy === ph).length}`).join(", ");
  host.setAttribute(
    "aria-label",
    `Timeline of ${dated.length} World Action Model papers by first arXiv date, ${startYear} to ${endYear}, grouped by design philosophy: ${laneSummary}.`,
  );
  for (let y = startYear + 1; y <= endYear; y += 1) {
    const raw = xOf(Date.UTC(y, 0, 1));
    if (raw > 1 && raw < 99) grid.append(el("div", { class: "tl-gridline", style: `left:${raw}%` }));
  }
  host.append(grid);

  // lanes, one per philosophy
  const lanes = el("div", { class: "tl-lanes" });
  const jitter = [0, 9, -9, 5, -5, 13, -13];
  PHIL_ORDER.forEach((ph) => {
    const papers = dated.filter((p) => p.philosophy === ph).sort((a, b) => t(a) - t(b));
    const lane = el("div", { class: "tl-lane" });
    const head = el("div", { class: "tl-lane-head" });
    head.append(
      el("span", { class: "tl-lane-name", text: ph }),
      el("span", { class: "tl-lane-count", text: `${papers.length} papers` }),
    );
    const track = el("div", { class: "tl-track" });
    papers.forEach((p, i) => {
      track.append(
        el("span", {
          class: "tl-dot",
          style: `left:${xOf(t(p))}%; top:calc(50% + ${jitter[i % jitter.length]}px)`,
          "data-name": p.shortName,
          "data-title": p.title,
          "data-date": formatDate(p.firstVersionDate),
        }),
      );
    });
    lane.append(head, track);
    lanes.append(lane);
  });
  host.append(lanes);

  // year axis
  const axis = el("div", { class: "tl-axis" });
  for (let y = startYear; y <= endYear; y += 1) {
    const x = Math.max(0, Math.min(100, xOf(Date.UTC(y, 0, 1))));
    axis.append(el("span", { class: "tl-year", style: `left:${x}%`, text: String(y) }));
  }
  host.append(axis);
}

// custom timeline tooltip — a floating popover that follows the cursor (fixed, clamped to viewport)
function timelineTip() {
  let tip = document.getElementById("tl-tip");
  if (!tip) {
    tip = el("div", { class: "tl-tip", id: "tl-tip" });
    document.body.append(tip);
  }
  return tip;
}

function showDotTip(dot, e) {
  const tip = timelineTip();
  tip.innerHTML =
    `<strong>${escapeHtml(dot.dataset.name)}</strong>${escapeHtml(dot.dataset.title)}` +
    `<span class="tl-tip-date">${escapeHtml(dot.dataset.date)}</span>`;
  tip.classList.add("is-on");
  moveDotTip(e);
}

function moveDotTip(e) {
  const tip = document.getElementById("tl-tip");
  if (!tip || !tip.classList.contains("is-on")) return;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  let x = e.clientX + 14;
  let y = e.clientY - h - 14;
  if (x + w + 8 > vw) x = e.clientX - w - 14; // flip to the left of the cursor near the right edge
  if (x < 8) x = 8;
  if (y < 8) y = e.clientY + 18; // drop below the cursor when there is no room above
  if (y + h + 8 > vh) y = vh - h - 8;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}

function hideDotTip() {
  const tip = document.getElementById("tl-tip");
  if (tip) tip.classList.remove("is-on");
}

/* ---------- states ---------- */

function showSkeleton() {
  selectors.matrix.innerHTML = "";
  selectors.matrix.className = "matrix";
  selectors.matrix.append(el("div", { class: "skeleton", style: "min-height:140px" }));
  selectors.list.innerHTML = "";
  for (let i = 0; i < 6; i += 1) selectors.list.append(el("div", { class: "skeleton paper-card", style: "box-shadow:none" }));
}

function showError(err) {
  // clear the matrix shimmer and timeline so a load failure doesn't leave them stuck
  selectors.matrix.className = "matrix";
  selectors.matrix.innerHTML = "";
  if (selectors.timeline) selectors.timeline.innerHTML = "";
  selectors.list.innerHTML = "";
  const card = el("div", { class: "state-card" }, `<strong>Paper data could not load</strong><p>${escapeHtml(err.message || String(err))}</p>`);
  const retry = el("button", { type: "button", text: "Retry" });
  retry.addEventListener("click", () => init());
  card.append(retry);
  selectors.list.append(card);
}

/* ---------- events ---------- */

function isTyping(target) {
  return target && (/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName) || target.isContentEditable);
}

function bindEvents() {
  selectors.search.addEventListener("input", (e) => {
    const v = e.target.value;
    selectors.searchClear.hidden = !v.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = v.trim();
      sync();
    }, 120);
  });

  selectors.searchClear.addEventListener("click", () => {
    clearTimeout(searchTimer);
    state.search = "";
    selectors.search.value = "";
    selectors.search.focus();
    sync();
  });

  selectors.sort.addEventListener("change", (e) => {
    state.sort = e.target.value;
    sync();
  });

  // The matrix is a single-region navigator: clicking a cell / row / column REPLACES the
  // philosophy+substrate selection (re-click clears) instead of adding into two independent
  // sets — otherwise the highlight shows the cross-product of both axes (pick 2 cells in
  // different rows+cols and 4 light up). Other facets (backbone/coupling/deployment) are untouched;
  // multi-select still lives in the left rail.
  selectors.matrix.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "cell" && b.getAttribute("aria-disabled") === "true") return;
    const ph = state.filters.philosophy;
    const sub = state.filters.substrateGroup;
    const onlyPhil = (v) => ph.size === 1 && ph.has(v);
    const onlySub = (v) => sub.size === 1 && sub.has(v);

    if (act === "cell") {
      const isSole = onlyPhil(b.dataset.ph) && onlySub(b.dataset.sub);
      ph.clear();
      sub.clear();
      if (!isSole) {
        ph.add(b.dataset.ph);
        sub.add(b.dataset.sub);
      }
    } else if (act === "row") {
      const isSole = onlyPhil(b.dataset.ph) && sub.size === 0;
      ph.clear();
      sub.clear();
      if (!isSole) ph.add(b.dataset.ph);
    } else if (act === "col") {
      const isSole = onlySub(b.dataset.sub) && ph.size === 0;
      ph.clear();
      sub.clear();
      if (!isSole) sub.add(b.dataset.sub);
    }
    sync();
  });

  selectors.filterPanel.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-group]");
    if (!b || b.disabled) return;
    toggleSet(b.dataset.group, b.dataset.value);
    sync();
  });

  selectors.density.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-density]");
    if (!b) return;
    state.density = b.dataset.density;
    try { localStorage.setItem("wam-density", state.density); } catch (_) { /* ignore */ }
    applyDensity();
    updateDensityButtons();
    layoutMasonry();
  });

  let masonryTimer;
  window.addEventListener("resize", () => {
    clearTimeout(masonryTimer);
    masonryTimer = setTimeout(layoutMasonry, 120);
  });
  window.addEventListener("load", layoutMasonry);

  selectors.chips.addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    removeChip(b);
  });
  selectors.chips.addEventListener("keydown", (e) => {
    if (e.key !== "Backspace" && e.key !== "Delete") return;
    const b = e.target.closest(".chip");
    if (!b) return;
    e.preventDefault();
    removeChip(b);
  });

  selectors.clear.addEventListener("click", clearAll);

  selectors.filtersOpen.addEventListener("click", openSheet);
  selectors.filtersClose.addEventListener("click", () => closeSheet());
  selectors.backdrop.addEventListener("click", () => closeSheet());

  if (selectors.timeline) {
    selectors.timeline.addEventListener("pointerover", (e) => {
      const dot = e.target.closest(".tl-dot");
      if (dot) showDotTip(dot, e);
    });
    selectors.timeline.addEventListener("pointermove", (e) => {
      if (e.target.closest(".tl-dot")) moveDotTip(e);
      else hideDotTip();
    });
    selectors.timeline.addEventListener("pointerout", (e) => {
      if (e.target.closest(".tl-dot")) hideDotTip();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !isTyping(e.target) && !document.body.classList.contains("filters-open")) {
      e.preventDefault();
      selectors.search.focus();
    } else if (e.key === "Escape" && !document.body.classList.contains("filters-open")) {
      if (document.activeElement === selectors.search && state.search) {
        clearTimeout(searchTimer);
        state.search = "";
        selectors.search.value = "";
        sync();
      }
    }
  });

  railMode.addEventListener("change", (e) => {
    if (e.matches) closeSheet(false);
  });
  matrixCompact.addEventListener("change", renderMatrix);

  window.addEventListener("popstate", () => {
    setStateFromURL();
    reflectControls();
    sync();
  });

  // toolbar deepens its shadow only while actually stuck
  if (selectors.toolbar && "IntersectionObserver" in window) {
    const sentinel = el("div", { class: "toolbar-sentinel", "aria-hidden": "true" });
    selectors.toolbar.before(sentinel);
    // detection line must match the sticky pin line (nav-bar-h + space-sm), not the viewport top
    const stickyTop = Math.round(parseFloat(getComputedStyle(selectors.toolbar).top)) || 64;
    new IntersectionObserver(
      ([e]) => selectors.toolbar.classList.toggle("is-stuck", e.intersectionRatio < 1),
      { threshold: [1], rootMargin: `-${stickyTop}px 0px 0px 0px` },
    ).observe(sentinel);
  }

  setupScrollSpy();
}

function removeChip(b) {
  clearTimeout(searchTimer);
  const idx = [...selectors.chips.children].indexOf(b);
  const key = b.dataset.chipKey;
  if (key === "search") {
    state.search = "";
    selectors.search.value = "";
  } else {
    state.filters[key].delete(b.dataset.chipVal);
  }
  sync();
  const chips = [...selectors.chips.children];
  const fallback = railMode.matches ? selectors.clear : selectors.filtersOpen;
  const next = chips[idx] || chips[idx - 1] || fallback || selectors.search;
  if (next) next.focus();
}

// Keep the active nav link visible — but ONLY by scrolling the nav's own horizontal
// overflow, never the document. (Element.scrollIntoView on a link inside the sticky
// top bar would scroll the whole page vertically and yank the user back.)
function centerNavLink(link) {
  const nav = link.closest("nav");
  if (!nav || nav.scrollWidth <= nav.clientWidth + 1) return;
  const navRect = nav.getBoundingClientRect();
  const linkRect = link.getBoundingClientRect();
  const delta = linkRect.left + linkRect.width / 2 - (navRect.left + navRect.width / 2);
  nav.scrollBy({ left: delta, behavior: "smooth" });
}

function setupScrollSpy() {
  const links = [...document.querySelectorAll(".side-nav nav a")];
  const map = new Map();
  links.forEach((a) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (target) map.set(target, a);
  });
  if (!map.size || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const active = map.get(en.target);
        links.forEach((a) => a.setAttribute("aria-current", String(a === active)));
        if (active) centerNavLink(active);
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
  );
  map.forEach((_, target) => io.observe(target));
}

/* ---------- init ---------- */

async function init() {
  try {
    state.density = localStorage.getItem("wam-density") === "compact" ? "compact" : "comfortable";
  } catch (_) {
    state.density = "comfortable";
  }
  applyDensity();
  showSkeleton();
  setStateFromURL();

  try {
    const response = await fetch("assets/data/papers.json");
    const data = await response.json();
    state.papers = data.papers.map((p) => ({
      ...p,
      citationCount: Number(p.citationCount) || 0,
      substrateGroups: substrateGroups(p.substrate),
    }));

    document.querySelectorAll("[data-total-papers]").forEach((n) => (n.textContent = number(state.papers.length)));
    selectors.metadataDate.textContent = formatUpdate(data.metadata.metadataUpdatedAt || data.metadata.generatedAt);

    buildFilters();
    buildDensity();
    buildCards();
    renderMatrix();
    renderTimeline();
    reflectControls();
    updateToolbar();
    if (!boundOnce) {
      bindEvents();
      boundOnce = true;
    }
    sync();
  } catch (error) {
    showError(error);
  }
}

let boundOnce = false;
init();
