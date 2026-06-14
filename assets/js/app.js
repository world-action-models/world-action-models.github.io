const state = {
  papers: [],
  search: "",
  sort: "recent",
  filters: {
    philosophy: new Set(),
    substrateGroup: new Set(),
    backbone: new Set(),
    coupling: new Set(),
    deployment: new Set(),
  },
};

const philosophyOrder = ["Render-and-Decode", "Latent-Only", "Video-Generation-Free"];
const substrateOrder = ["Pixel-grounded", "Feature", "Geometric", "Affordance"];

const selectors = {
  search: document.querySelector("#paper-search"),
  sort: document.querySelector("#paper-sort"),
  paperList: document.querySelector("#paper-list"),
  resultCount: document.querySelector("#result-count"),
  metadataDate: document.querySelector("#metadata-date"),
  matrix: document.querySelector("#taxonomy-matrix"),
  clear: document.querySelector("#clear-filters"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function substrateGroups(substrate) {
  const groups = new Set();
  if (/Pixel|Audio/i.test(substrate)) groups.add("Pixel-grounded");
  if (/Feature/i.test(substrate)) groups.add("Feature");
  if (/Geometric/i.test(substrate)) groups.add("Geometric");
  if (/Affordance/i.test(substrate)) groups.add("Affordance");
  return [...groups];
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

function number(value) {
  return new Intl.NumberFormat("en").format(Number(value) || 0);
}

function uniqueValues(key) {
  return [...new Set(state.papers.map((paper) => paper[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function matchesFilters(paper) {
  const text = [
    paper.shortName,
    paper.title,
    paper.philosophy,
    paper.substrate,
    paper.backbone,
    paper.coupling,
    paper.deployment,
    paper.backboneDetail,
    paper.tldr,
  ]
    .join(" ")
    .toLowerCase();

  if (state.search && !text.includes(state.search.toLowerCase())) return false;

  for (const [key, values] of Object.entries(state.filters)) {
    if (!values.size) continue;
    if (key === "substrateGroup") {
      if (!paper.substrateGroups.some((group) => values.has(group))) return false;
    } else if (!values.has(paper[key])) {
      return false;
    }
  }
  return true;
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

function renderFilterButtons(group, values) {
  const container = document.querySelector(`[data-filter-group="${group}"]`);
  container.innerHTML = values
    .map((value) => {
      const active = state.filters[group].has(value);
      return `<button type="button" data-group="${escapeHtml(group)}" data-value="${escapeHtml(value)}" aria-pressed="${active}">${escapeHtml(value)}</button>`;
    })
    .join("");
}

function renderFilters() {
  renderFilterButtons("philosophy", philosophyOrder);
  renderFilterButtons("substrateGroup", substrateOrder);
  renderFilterButtons("backbone", uniqueValues("backbone"));
  renderFilterButtons("coupling", uniqueValues("coupling"));
  renderFilterButtons("deployment", uniqueValues("deployment"));
}

function renderMatrix() {
  const cells = [];
  cells.push('<div class="cell head" aria-hidden="true">Philosophy</div>');
  for (const substrate of substrateOrder) cells.push(`<div class="cell head">${escapeHtml(substrate)}</div>`);

  for (const philosophy of philosophyOrder) {
    cells.push(`<div class="cell row-head">${escapeHtml(philosophy)}</div>`);
    for (const substrate of substrateOrder) {
      const count = state.papers.filter(
        (paper) => paper.philosophy === philosophy && paper.substrateGroups.includes(substrate),
      ).length;
      const active = state.filters.philosophy.has(philosophy) && state.filters.substrateGroup.has(substrate);
      cells.push(`
        <button type="button" class="${active ? "active" : ""}" data-matrix-philosophy="${escapeHtml(philosophy)}" data-matrix-substrate="${escapeHtml(substrate)}" aria-label="${escapeHtml(philosophy)} and ${escapeHtml(substrate)}: ${count} papers">
          <span class="matrix-count">${number(count)}</span>
          <span class="matrix-label">papers</span>
        </button>
      `);
    }
  }
  selectors.matrix.innerHTML = cells.join("");
}

function paperCard(paper) {
  const citationTitle = `${paper.citationSource || "citation source"} · updated ${formatUpdate(paper.citationUpdatedAt)}`;
  const philosophyClass = `philosophy-${slug(paper.philosophy)}`;
  return `
    <article class="paper-card">
      <div class="paper-top">
        <div>
          <h3>${escapeHtml(paper.shortName)}</h3>
          <div class="paper-title">${escapeHtml(paper.title)}</div>
        </div>
        <a class="arxiv-link" href="${escapeHtml(paper.arxivUrl)}" target="_blank" rel="noopener">arXiv ${escapeHtml(paper.arxivId)} <span aria-hidden="true">↗</span></a>
      </div>
      <div class="paper-meta">
        <span class="meta-chip citations" title="${escapeHtml(citationTitle)}">${number(paper.citationCount)} citations</span>
        <span class="meta-chip date">First arXiv: ${formatDate(paper.firstVersionDate)}</span>
        <span class="meta-chip source">${escapeHtml(paper.citationSource || "not indexed")}</span>
      </div>
      <div class="paper-tags">
        <span class="tag ${philosophyClass}">${escapeHtml(paper.philosophy)}</span>
        <span class="tag">${escapeHtml(paper.substrate)}</span>
        <span class="tag">${escapeHtml(paper.backbone)}</span>
        <span class="tag">${escapeHtml(paper.coupling)}</span>
        <span class="tag">${escapeHtml(paper.deployment)}</span>
      </div>
      <p class="paper-summary">${escapeHtml(paper.tldr || paper.backboneDetail || "Survey census entry.")}</p>
      <div class="paper-bottom">
        <span class="backbone-detail">${escapeHtml(paper.backboneDetail)}</span>
      </div>
    </article>
  `;
}

function renderPapers() {
  const filtered = sortedPapers(state.papers.filter(matchesFilters));
  selectors.resultCount.textContent = `${number(filtered.length)} ${filtered.length === 1 ? "paper" : "papers"}`;
  selectors.paperList.innerHTML = filtered.map(paperCard).join("");
}

function sync() {
  renderFilters();
  renderMatrix();
  renderPapers();
}

function bindEvents() {
  selectors.search.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    renderPapers();
  });

  selectors.sort.addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderPapers();
  });

  document.addEventListener("click", (event) => {
    const filterButton = event.target.closest("[data-filter-group] button");
    if (filterButton) {
      const group = filterButton.dataset.group;
      const value = filterButton.dataset.value;
      const values = state.filters[group];
      if (values.has(value)) values.delete(value);
      else values.add(value);
      sync();
      return;
    }

    const matrixButton = event.target.closest("[data-matrix-philosophy]");
    if (matrixButton) {
      const philosophy = matrixButton.dataset.matrixPhilosophy;
      const substrate = matrixButton.dataset.matrixSubstrate;
      const active = state.filters.philosophy.has(philosophy) && state.filters.substrateGroup.has(substrate);
      state.filters.philosophy.clear();
      state.filters.substrateGroup.clear();
      if (!active) {
        state.filters.philosophy.add(philosophy);
        state.filters.substrateGroup.add(substrate);
      }
      sync();
      return;
    }

  });

  selectors.clear.addEventListener("click", () => {
    state.search = "";
    selectors.search.value = "";
    for (const values of Object.values(state.filters)) values.clear();
    sync();
  });
}

async function init() {
  const response = await fetch("assets/data/papers.json");
  const data = await response.json();
  state.papers = data.papers.map((paper) => ({
    ...paper,
    citationCount: Number(paper.citationCount) || 0,
    substrateGroups: substrateGroups(paper.substrate),
  }));

  document.querySelectorAll("[data-total-papers]").forEach((node) => {
    node.textContent = number(state.papers.length);
  });
  selectors.metadataDate.textContent = formatUpdate(data.metadata.metadataUpdatedAt || data.metadata.generatedAt);
  bindEvents();
  sync();
}

init().catch((error) => {
  selectors.paperList.innerHTML = `<article class="paper-card"><h3>Paper data could not load</h3><p class="paper-summary">${escapeHtml(error.message)}</p></article>`;
});
