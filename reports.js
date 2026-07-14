/**
 * Reporting layer over the raw `books` table.
 * All aggregations run in SQL so the UI stays thin.
 */

function parseFilters(query = {}) {
  const filters = {};
  if (query.genre && String(query.genre).trim()) {
    filters.genre = String(query.genre).trim();
  }
  if (query.author && String(query.author).trim()) {
    filters.author = String(query.author).trim();
  }
  if (query.q && String(query.q).trim()) {
    filters.q = String(query.q).trim();
  }
  if (query.yearFrom !== undefined && query.yearFrom !== "") {
    const n = Number(query.yearFrom);
    if (!Number.isNaN(n)) filters.yearFrom = n;
  }
  if (query.yearTo !== undefined && query.yearTo !== "") {
    const n = Number(query.yearTo);
    if (!Number.isNaN(n)) filters.yearTo = n;
  }
  return filters;
}

function buildWhere(filters) {
  const clauses = [];
  const params = {};

  if (filters.genre) {
    clauses.push("genre = @genre");
    params.genre = filters.genre;
  }
  if (filters.author) {
    clauses.push("author = @author");
    params.author = filters.author;
  }
  if (filters.q) {
    clauses.push("(title LIKE @q OR author LIKE @q OR genre LIKE @q)");
    params.q = `%${filters.q}%`;
  }
  if (filters.yearFrom !== undefined) {
    clauses.push("year >= @yearFrom");
    params.yearFrom = filters.yearFrom;
  }
  if (filters.yearTo !== undefined) {
    clauses.push("year <= @yearTo");
    params.yearTo = filters.yearTo;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { where, params };
}

function getFilterOptions(db) {
  const genres = db
    .prepare("SELECT DISTINCT genre FROM books ORDER BY genre COLLATE NOCASE")
    .all()
    .map((r) => r.genre);
  const authors = db
    .prepare("SELECT DISTINCT author FROM books ORDER BY author COLLATE NOCASE")
    .all()
    .map((r) => r.author);
  const years = db
    .prepare("SELECT MIN(year) AS minYear, MAX(year) AS maxYear FROM books")
    .get();
  return {
    genres,
    authors,
    minYear: years?.minYear ?? null,
    maxYear: years?.maxYear ?? null,
  };
}

function getSummary(db, filters = {}) {
  const { where, params } = buildWhere(filters);
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS totalBooks,
         COUNT(DISTINCT author) AS uniqueAuthors,
         COUNT(DISTINCT genre) AS uniqueGenres,
         MIN(year) AS earliestYear,
         MAX(year) AS latestYear,
         ROUND(AVG(year), 1) AS averageYear
       FROM books
       ${where}`
    )
    .get(params);

  return {
    totalBooks: row.totalBooks || 0,
    uniqueAuthors: row.uniqueAuthors || 0,
    uniqueGenres: row.uniqueGenres || 0,
    earliestYear: row.earliestYear,
    latestYear: row.latestYear,
    averageYear: row.averageYear,
  };
}

function getByGenre(db, filters = {}) {
  const { where, params } = buildWhere(filters);
  return db
    .prepare(
      `SELECT genre AS label, COUNT(*) AS count
       FROM books
       ${where}
       GROUP BY genre
       ORDER BY count DESC, genre COLLATE NOCASE`
    )
    .all(params);
}

function getByAuthor(db, filters = {}) {
  const { where, params } = buildWhere(filters);
  return db
    .prepare(
      `SELECT author AS label, COUNT(*) AS count,
              MIN(year) AS earliestYear, MAX(year) AS latestYear
       FROM books
       ${where}
       GROUP BY author
       ORDER BY count DESC, author COLLATE NOCASE`
    )
    .all(params);
}

function getByDecade(db, filters = {}) {
  const { where, params } = buildWhere(filters);
  return db
    .prepare(
      `SELECT (year / 10) * 10 AS decade, COUNT(*) AS count
       FROM books
       ${where}
       GROUP BY decade
       ORDER BY decade`
    )
    .all(params)
    .map((r) => ({
      label: `${r.decade}s`,
      decade: r.decade,
      count: r.count,
    }));
}

function getRawRows(db, filters = {}) {
  const { where, params } = buildWhere(filters);
  return db
    .prepare(
      `SELECT id, title, author, year, genre, created_at
       FROM books
       ${where}
       ORDER BY year, title COLLATE NOCASE`
    )
    .all(params);
}

function getFullReport(db, query = {}) {
  const filters = parseFilters(query);
  return {
    filters,
    generatedAt: new Date().toISOString(),
    summary: getSummary(db, filters),
    byGenre: getByGenre(db, filters),
    byAuthor: getByAuthor(db, filters),
    byDecade: getByDecade(db, filters),
    raw: getRawRows(db, filters),
  };
}

function escapeCsv(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCsv(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsv(row[c.key])).join(",")
  );
  return [header, ...lines].join("\n") + "\n";
}

function exportRawCsv(db, query = {}) {
  const filters = parseFilters(query);
  const rows = getRawRows(db, filters);
  return toCsv(rows, [
    { key: "id", header: "id" },
    { key: "title", header: "title" },
    { key: "author", header: "author" },
    { key: "year", header: "year" },
    { key: "genre", header: "genre" },
    { key: "created_at", header: "created_at" },
  ]);
}

function exportSummaryCsv(db, query = {}) {
  const report = getFullReport(db, query);
  const lines = [];
  lines.push("section,label,count,earliestYear,latestYear");
  lines.push(
    [
      "summary",
      "totalBooks",
      report.summary.totalBooks,
      report.summary.earliestYear ?? "",
      report.summary.latestYear ?? "",
    ]
      .map(escapeCsv)
      .join(",")
  );
  for (const row of report.byGenre) {
    lines.push(["byGenre", row.label, row.count, "", ""].map(escapeCsv).join(","));
  }
  for (const row of report.byAuthor) {
    lines.push(
      [
        "byAuthor",
        row.label,
        row.count,
        row.earliestYear ?? "",
        row.latestYear ?? "",
      ]
        .map(escapeCsv)
        .join(",")
    );
  }
  for (const row of report.byDecade) {
    lines.push(["byDecade", row.label, row.count, "", ""].map(escapeCsv).join(","));
  }
  return lines.join("\n") + "\n";
}

module.exports = {
  parseFilters,
  getFilterOptions,
  getSummary,
  getByGenre,
  getByAuthor,
  getByDecade,
  getRawRows,
  getFullReport,
  exportRawCsv,
  exportSummaryCsv,
};
