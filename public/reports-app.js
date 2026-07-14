const filtersForm = document.getElementById("filters-form");
const resetBtn = document.getElementById("reset-filters");
const statusEl = document.getElementById("report-status");
const kpiGrid = document.getElementById("kpi-grid");
const genreChart = document.getElementById("genre-chart");
const genreBody = document.getElementById("genre-body");
const decadeChart = document.getElementById("decade-chart");
const decadeBody = document.getElementById("decade-body");
const authorBody = document.getElementById("author-body");
const rawBody = document.getElementById("raw-body");
const rawCount = document.getElementById("raw-count");
const exportRaw = document.getElementById("export-raw");
const exportSummary = document.getElementById("export-summary");

function currentParams() {
  const data = new FormData(filtersForm);
  const params = new URLSearchParams();
  for (const [key, value] of data.entries()) {
    const trimmed = String(value).trim();
    if (trimmed) params.set(key, trimmed);
  }
  return params;
}

function syncExportLinks(params) {
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";
  exportRaw.href = `/api/reports/export/raw.csv${suffix}`;
  exportSummary.href = `/api/reports/export/summary.csv${suffix}`;
}

function fillSelect(select, values, placeholder) {
  const current = select.value;
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "";
  all.textContent = placeholder;
  select.appendChild(all);
  for (const value of values) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
  if (values.includes(current)) select.value = current;
}

async function loadMeta() {
  const res = await fetch("/api/reports/meta");
  if (!res.ok) throw new Error("Could not load filter options");
  const meta = await res.json();
  fillSelect(filtersForm.genre, meta.genres, "All genres");
  fillSelect(filtersForm.author, meta.authors, "All authors");
  if (meta.minYear != null) {
    filtersForm.yearFrom.placeholder = String(meta.minYear);
    filtersForm.yearTo.placeholder = String(meta.maxYear);
  }
}

function renderKpis(summary) {
  const cards = [
    { label: "Books", value: summary.totalBooks },
    { label: "Authors", value: summary.uniqueAuthors },
    { label: "Genres", value: summary.uniqueGenres },
    {
      label: "Year span",
      value:
        summary.earliestYear != null
          ? `${summary.earliestYear}–${summary.latestYear}`
          : "—",
    },
    {
      label: "Avg year",
      value: summary.averageYear != null ? summary.averageYear : "—",
    },
  ];

  kpiGrid.innerHTML = "";
  for (const card of cards) {
    const el = document.createElement("article");
    el.className = "kpi";
    el.innerHTML = `<p class="kpi-value"></p><p class="kpi-label"></p>`;
    el.querySelector(".kpi-value").textContent = String(card.value);
    el.querySelector(".kpi-label").textContent = card.label;
    kpiGrid.appendChild(el);
  }
}

function renderBars(container, rows) {
  container.innerHTML = "";
  if (!rows.length) {
    container.innerHTML = '<p class="empty-inline">No data for these filters.</p>';
    return;
  }
  const max = Math.max(...rows.map((r) => r.count), 1);
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "bar-row";
    const pct = Math.round((row.count / max) * 100);
    item.innerHTML = `
      <span class="bar-label"></span>
      <div class="bar-track"><div class="bar-fill" style="--w:${pct}%"></div></div>
      <span class="bar-count"></span>
    `;
    item.querySelector(".bar-label").textContent = row.label;
    item.querySelector(".bar-count").textContent = String(row.count);
    container.appendChild(item);
  }
}

function renderGenreTable(rows, total) {
  genreBody.innerHTML = "";
  if (!rows.length) {
    genreBody.innerHTML =
      '<tr><td colspan="3" class="empty">No genre breakdown.</td></tr>';
    return;
  }
  for (const row of rows) {
    const tr = document.createElement("tr");
    const share = total ? Math.round((row.count / total) * 100) : 0;
    tr.innerHTML = "<td></td><td></td><td></td>";
    const cells = tr.querySelectorAll("td");
    cells[0].textContent = row.label;
    cells[1].textContent = String(row.count);
    cells[2].textContent = `${share}%`;
    genreBody.appendChild(tr);
  }
}

function renderDecadeTable(rows) {
  decadeBody.innerHTML = "";
  if (!rows.length) {
    decadeBody.innerHTML =
      '<tr><td colspan="2" class="empty">No decade breakdown.</td></tr>';
    return;
  }
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td></td><td></td>";
    const cells = tr.querySelectorAll("td");
    cells[0].textContent = row.label;
    cells[1].textContent = String(row.count);
    decadeBody.appendChild(tr);
  }
}

function renderAuthors(rows) {
  authorBody.innerHTML = "";
  if (!rows.length) {
    authorBody.innerHTML =
      '<tr><td colspan="3" class="empty">No author breakdown.</td></tr>';
    return;
  }
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td></td><td></td><td></td>";
    const cells = tr.querySelectorAll("td");
    cells[0].textContent = row.label;
    cells[1].textContent = String(row.count);
    cells[2].textContent =
      row.earliestYear === row.latestYear
        ? String(row.earliestYear)
        : `${row.earliestYear}–${row.latestYear}`;
    authorBody.appendChild(tr);
  }
}

function renderRaw(rows) {
  rawBody.innerHTML = "";
  rawCount.textContent = `${rows.length} row${rows.length === 1 ? "" : "s"}`;
  if (!rows.length) {
    rawBody.innerHTML =
      '<tr><td colspan="5" class="empty">No rows match these filters.</td></tr>';
    return;
  }
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td class='title-cell'></td><td></td><td></td><td></td><td></td>";
    const cells = tr.querySelectorAll("td");
    cells[0].textContent = row.title;
    cells[1].textContent = row.author;
    cells[2].textContent = String(row.year);
    cells[3].textContent = row.genre;
    cells[4].textContent = String(row.created_at || "").replace("T", " ").slice(0, 19);
    rawBody.appendChild(tr);
  }
}

async function loadReport() {
  const params = currentParams();
  syncExportLinks(params);
  statusEl.textContent = "Loading…";

  const res = await fetch(`/api/reports?${params.toString()}`);
  if (!res.ok) throw new Error("Could not load report");
  const report = await res.json();

  renderKpis(report.summary);
  renderBars(genreChart, report.byGenre);
  renderGenreTable(report.byGenre, report.summary.totalBooks);
  renderBars(decadeChart, report.byDecade);
  renderDecadeTable(report.byDecade);
  renderAuthors(report.byAuthor);
  renderRaw(report.raw);

  statusEl.textContent = `Updated ${new Date(report.generatedAt).toLocaleString()}`;
}

filtersForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await loadReport();
  } catch (err) {
    statusEl.textContent = err.message || "Failed to load report";
  }
});

resetBtn.addEventListener("click", async () => {
  filtersForm.reset();
  try {
    await loadReport();
  } catch (err) {
    statusEl.textContent = err.message || "Failed to load report";
  }
});

(async function init() {
  try {
    await loadMeta();
    await loadReport();
  } catch (err) {
    statusEl.textContent = err.message || "Failed to start reports";
  }
})();
