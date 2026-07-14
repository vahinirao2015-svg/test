const express = require("express");
const path = require("path");
const { getDb, seed, listBooks, getBook, addBook, deleteBook } = require("./db");

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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Open that URL to browse the sample books database.");
});
