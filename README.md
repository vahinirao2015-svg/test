# Sample Library — Raw Data Reporting

Node.js + Express + SQLite demo with a **catalog** for raw book rows and a **reporting** layer that aggregates, filters, and exports that data.

## What you get

| Area | What it does |
| --- | --- |
| Catalog (`/`) | Browse, add, and delete books in `data/sample.db` |
| Reports (`/reports.html`) | Filter raw rows; see KPIs, genre/author/decade breakdowns; download CSV |
| Reporting API | JSON report + CSV exports driven by the same filters |

```
Browser
  ├─ /               → catalog UI
  └─ /reports.html   → reporting dashboard
         │
         ▼
Express (server.js)
  ├─ /api/books*     → CRUD on raw rows
  └─ /api/reports*   → aggregations + CSV (reports.js)
         │
         ▼
SQLite (data/sample.db)
```

## Quick start

```bash
npm install
npm start
```

- Catalog: [http://localhost:3000](http://localhost:3000)
- Reports: [http://localhost:3000/reports.html](http://localhost:3000/reports.html)

On first launch the DB is created and seeded with sample books.

## Reporting API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/reports/meta` | Distinct genres/authors and year range for filters |
| `GET` | `/api/reports` | Full report: summary, byGenre, byAuthor, byDecade, raw rows |
| `GET` | `/api/reports/export/raw.csv` | CSV of filtered raw rows |
| `GET` | `/api/reports/export/summary.csv` | CSV of summary + breakdowns |

### Filter query params (all optional)

| Param | Effect |
| --- | --- |
| `q` | Search title, author, or genre (substring) |
| `genre` | Exact genre |
| `author` | Exact author |
| `yearFrom` | Inclusive lower year bound |
| `yearTo` | Inclusive upper year bound |

Examples:

```bash
curl 'http://localhost:3000/api/reports'
curl 'http://localhost:3000/api/reports?genre=Sci-Fi&yearFrom=1960'
curl -OJ 'http://localhost:3000/api/reports/export/raw.csv?author=Jane%20Austen'
```

## Catalog API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/books` | List all books |
| `GET` | `/api/books/:id` | Get one book |
| `POST` | `/api/books` | Add a book (`title`, `author`, `year`, `genre`) |
| `DELETE` | `/api/books/:id` | Delete a book |

## Files

| File | Role |
| --- | --- |
| `db.js` | Schema, seed data, book CRUD |
| `reports.js` | Filter parsing, SQL aggregations, CSV export |
| `server.js` | HTTP routes for catalog + reports |
| `public/` | Catalog and reports UIs |

## Requirements

- Node.js 18+
- Native build tools for `better-sqlite3` if a prebuilt binary is unavailable
