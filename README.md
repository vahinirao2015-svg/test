# AssetLedger — IT Inventory System

A web app for storing and managing IT inventory data: laptops, monitors, phones, servers, network gear, peripherals, and software licenses.

## Features

- **Persistent SQLite storage** (`data/inventory.db`)
- **User management** with roles: `admin`, `editor`, `viewer`
- **Login sessions** (JWT cookie) protecting inventory and admin pages
- **Full CRUD** for inventory assets via REST API and UI
- **Search and filters** by category, status, and department
- **Assignment tracking** (person, email, department, location)
- **Purchase and warranty metadata** with inventory value summary
- **Seed data** loads automatically on first run
- **Docker deployment** with a persistent data volume (optional HTTPS via Caddy)

## Quick start (local)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Default accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@assetledger.local` | `Admin123!` | admin |
| `asha.patel@example.com` | `Editor123!` | editor |
| `marcus.chen@example.com` | `Viewer123!` | viewer |

Set a strong `AUTH_SECRET` in `.env` for production.

### Roles

- **admin** — manage users + inventory
- **editor** — create/update/delete assets
- **viewer** — read-only inventory

## Docker plan

### Architecture

```text
Browser
  │
  ▼
[Caddy :443]  ← optional, custom domain + TLS
  │
  ▼
[AssetLedger Next.js :3000]
  │
  ▼
[SQLite volume]  →  /app/data/inventory.db
```

| Piece | Choice | Why |
|-------|--------|-----|
| Image | Multi-stage Node 22 | Small runtime image, native build tools only in build stage |
| Next output | `standalone` | Minimal production server (`node server.js`) |
| Database | SQLite file on a Docker volume | Inventory must survive container restarts |
| HTTPS / domain | Optional Caddy profile | Automatic certificates once DNS points here |

**Do not** run this image on ephemeral serverless hosts without a mounted volume — SQLite needs durable disk.

### Run with Docker Compose

```bash
docker compose up -d --build
```

App: [http://localhost:3000](http://localhost:3000)

Data persists in the Docker volume `inventory-data`.

### Custom domain + HTTPS

1. Point DNS `A` / `AAAA` records for your domain to the server public IP.
2. Open ports **80** and **443**.
3. Start with the HTTPS profile:

```bash
DOMAIN=inventory.example.com docker compose --profile https up -d --build
```

Caddy uses `deploy/Caddyfile` and requests a Let's Encrypt certificate for `$DOMAIN`.

After HTTPS is working, you can remove the published `3000:3000` mapping from `docker-compose.yml` so the app is only reachable through Caddy.

### Useful commands

```bash
# Logs
docker compose logs -f app

# Health status
docker compose ps
curl http://localhost:3000/api/health

# Rebuild after code changes (required for healthcheck fix)
docker compose up -d --build --force-recreate

# Shell into the container
docker compose exec app sh

# Stop
docker compose down

# Stop and delete inventory data (destructive)
docker compose down -v
```

### Container shows `unhealthy`?

Most common cause after user login was added: the old healthcheck called `/api/assets`, which now returns **401** without a session. Rebuild with the updated image that checks `/api/health` instead:

```bash
docker compose down
docker compose up -d --build --force-recreate
docker compose ps
```

If it is still unhealthy:

```bash
docker compose logs --tail=100 app
docker inspect assetledger --format '{{json .State.Health}}'
```

### Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_PATH` | `/app/data/inventory.db` | SQLite file location inside the container |
| `PORT` | `3000` | App listen port |
| `HOSTNAME` | `0.0.0.0` | Bind address for Docker networking |
| `DOMAIN` | `localhost` | Hostname used by Caddy when `--profile https` is enabled |
| `AUTH_SECRET` | dev fallback | Secret used to sign login session cookies |

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth` | Login (`email`, `password`) |
| `GET` | `/api/auth` | Current session user |
| `DELETE` | `/api/auth` | Logout |
| `GET` | `/api/users` | List users (auth required) |
| `POST` | `/api/users` | Create user (admin) |
| `PUT` | `/api/users/:id` | Update user (admin) |
| `DELETE` | `/api/users/:id` | Delete user (admin) |
| `GET` | `/api/assets` | List assets (`search`, `category`, `status`, `department`) |
| `GET` | `/api/assets?include=meta` | List assets plus stats, departments, and enums |
| `POST` | `/api/assets` | Create an asset |
| `GET` | `/api/assets/:id` | Get one asset |
| `PUT` | `/api/assets/:id` | Update an asset |
| `DELETE` | `/api/assets/:id` | Delete an asset |

### Example create payload

```json
{
  "assetTag": "IT-1010",
  "name": "Dell Latitude 5440",
  "category": "Laptop",
  "manufacturer": "Dell",
  "model": "Latitude 5440",
  "serialNumber": "ABC123",
  "status": "Available",
  "assignedTo": "",
  "assignedEmail": "",
  "department": "IT",
  "location": "Store Room",
  "purchaseDate": "2025-06-01",
  "warrantyExpiry": "2028-06-01",
  "purchaseCost": 1299,
  "notes": ""
}
```

## Reset database

```bash
npm run db:reset
npm run dev
```

Sample records are re-seeded when the database is empty.

## Stack

- Next.js (App Router, standalone output)
- React 19
- SQLite via `better-sqlite3`
- TypeScript + Tailwind CSS
- Docker Compose (+ optional Caddy)
