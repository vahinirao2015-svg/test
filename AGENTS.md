# AGENTS.md

## Cursor Cloud specific instructions

This is a small **Node.js + Express + SQLite** book-catalog demo. Standard commands live in `README.md` and `package.json`; this section only captures non-obvious context.

### Services
- **Web server (`server.js`)**: the only service. Serves the frontend from `public/` and a REST API under `/api/books`, listening on `PORT` (default `3000`). Run with `npm run dev` (alias of `npm start` → `node server.js`); there is no separate build step and no watch/hot-reload — restart the process to pick up code changes.
- **Database**: SQLite via the native `better-sqlite3` module, embedded in-process. There is **no** separate DB service. On startup the server creates and seeds `data/sample.db` automatically (only seeds when the table is empty). `data/` and `*.db*` are gitignored.

### Testing / lint / build
- There is **no** test suite, lint config, or build step in this repo. Verify changes by running the server and exercising the API (e.g. `curl http://localhost:3000/api/books`) or the UI at `http://localhost:3000`.

### Notes
- `npm run seed` (`node db.js --seed`) is optional; the server already auto-seeds on boot.
