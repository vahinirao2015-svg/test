# Website with a Sample Database

A small **Node.js + Express + SQLite** demo that shows how a website talks to a database.

The site is a book catalog: it seeds sample rows into `data/sample.db`, serves a webpage, and exposes a JSON API to list, add, and delete books.

## How it works

```
Browser (HTML/JS)
    │  fetch /api/books
    ▼
Express server (server.js)
    │  SQL queries
    ▼
SQLite file (data/sample.db)
```

| Piece | Role |
| --- | --- |
| `db.js` | Creates the database, table, and sample seed data |
| `server.js` | HTTP server + REST API |
| `public/` | Frontend (page, styles, client JS) |
| `data/sample.db` | Created automatically on first run |

## Quick start

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

You should see six seeded books. Use the form to add more; Delete removes a row from the database.

Re-seed only when the table is empty:

```bash
npm run seed
```

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/books` | List all books |
| `GET` | `/api/books/:id` | Get one book |
| `POST` | `/api/books` | Add a book (`title`, `author`, `year`, `genre`) |
| `DELETE` | `/api/books/:id` | Delete a book |

Example:

```bash
curl http://localhost:3000/api/books
curl -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Dune","author":"Frank Herbert","year":1965,"genre":"Sci-Fi"}'
```

## Steps to build this yourself

1. **Pick a stack** — here: Node.js for the server, SQLite for a file-based database (no separate DB server).
2. **Define a schema** — e.g. a `books` table with `id`, `title`, `author`, `year`, `genre`.
3. **Seed sample data** — insert a few rows so the site is useful on first launch (`db.js`).
4. **Expose an API** — routes that read/write the database (`server.js`).
5. **Build a UI** — HTML/CSS/JS that calls the API and renders results (`public/`).
6. **Run locally** — `npm install && npm start`.

## Swap SQLite for another database later

The same pattern works with PostgreSQL or MySQL:

1. Create a database and table (same columns).
2. Replace `better-sqlite3` calls in `db.js` with a client like `pg` or `mysql2`.
3. Keep the Express routes and frontend the same.

## Requirements

- Node.js 18+
- Build tools for `better-sqlite3` (usually present on Linux/macOS; on Windows, install build tools if install fails)
