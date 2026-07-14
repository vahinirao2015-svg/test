const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "sample.db");

const SAMPLE_BOOKS = [
  {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    year: 1925,
    genre: "Fiction",
  },
  {
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    year: 1960,
    genre: "Fiction",
  },
  {
    title: "1984",
    author: "George Orwell",
    year: 1949,
    genre: "Dystopian",
  },
  {
    title: "Pride and Prejudice",
    author: "Jane Austen",
    year: 1813,
    genre: "Romance",
  },
  {
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    year: 1937,
    genre: "Fantasy",
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    year: 2018,
    genre: "Self-Help",
  },
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getDb() {
  ensureDataDir();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      year INTEGER NOT NULL,
      genre TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function seed(db) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM books").get().n;
  if (count > 0) {
    console.log(`Database already has ${count} book(s); skipping seed.`);
    return;
  }

  const insert = db.prepare(
    "INSERT INTO books (title, author, year, genre) VALUES (@title, @author, @year, @genre)"
  );
  const insertMany = db.transaction((books) => {
    for (const book of books) insert.run(book);
  });
  insertMany(SAMPLE_BOOKS);
  console.log(`Seeded ${SAMPLE_BOOKS.length} sample books into ${DB_PATH}`);
}

function listBooks(db) {
  return db
    .prepare("SELECT id, title, author, year, genre, created_at FROM books ORDER BY id")
    .all();
}

function getBook(db, id) {
  return db
    .prepare("SELECT id, title, author, year, genre, created_at FROM books WHERE id = ?")
    .get(id);
}

function addBook(db, { title, author, year, genre }) {
  const result = db
    .prepare(
      "INSERT INTO books (title, author, year, genre) VALUES (?, ?, ?, ?)"
    )
    .run(title, author, Number(year), genre);
  return getBook(db, result.lastInsertRowid);
}

function deleteBook(db, id) {
  const info = db.prepare("DELETE FROM books WHERE id = ?").run(id);
  return info.changes > 0;
}

if (require.main === module) {
  const db = getDb();
  seed(db);
  console.log("Current books:");
  console.table(listBooks(db));
  db.close();
}

module.exports = {
  getDb,
  seed,
  listBooks,
  getBook,
  addBook,
  deleteBook,
  DB_PATH,
};
