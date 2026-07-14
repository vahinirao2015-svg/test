const express = require("express");
const path = require("path");
const { getDb, seed, listBooks, getBook, addBook, deleteBook } = require("./db");
const {
  getFilterOptions,
  getFullReport,
  exportRawCsv,
  exportSummaryCsv,
} = require("./reports");

const app = express();
const PORT = process.env.PORT || 3000;

const db = getDb();
seed(db);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/books", (_req, res) => {
  try {
    res.json(listBooks(db));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load books" });
  }
});

app.get("/api/books/:id", (req, res) => {
  try {
    const book = getBook(db, Number(req.params.id));
    if (!book) return res.status(404).json({ error: "Book not found" });
    res.json(book);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load book" });
  }
});

app.post("/api/books", (req, res) => {
  try {
    const { title, author, year, genre } = req.body || {};
    if (!title || !author || !year || !genre) {
      return res
        .status(400)
        .json({ error: "title, author, year, and genre are required" });
    }
    const book = addBook(db, { title, author, year, genre });
    res.status(201).json(book);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add book" });
  }
});

app.delete("/api/books/:id", (req, res) => {
  try {
    const ok = deleteBook(db, Number(req.params.id));
    if (!ok) return res.status(404).json({ error: "Book not found" });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete book" });
  }
});

/** Reporting API — aggregates and exports over raw books rows */
app.get("/api/reports/meta", (_req, res) => {
  try {
    res.json(getFilterOptions(db));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load report filters" });
  }
});

app.get("/api/reports", (req, res) => {
  try {
    res.json(getFullReport(db, req.query));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to build report" });
  }
});

app.get("/api/reports/export/raw.csv", (req, res) => {
  try {
    const csv = exportRawCsv(db, req.query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="books-raw-report.csv"'
    );
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to export raw CSV" });
  }
});

app.get("/api/reports/export/summary.csv", (req, res) => {
  try {
    const csv = exportSummaryCsv(db, req.query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="books-summary-report.csv"'
    );
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to export summary CSV" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Reports dashboard: http://localhost:${PORT}/reports.html`);
});
