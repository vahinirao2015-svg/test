# AssetLedger — IT Inventory System

A web app for storing and managing IT inventory data: laptops, monitors, phones, servers, network gear, peripherals, and software licenses.

## Features

- **Persistent SQLite storage** (`data/inventory.db`)
- **Full CRUD** for inventory assets via REST API and UI
- **Search and filters** by category, status, and department
- **Assignment tracking** (person, email, department, location)
- **Purchase and warranty metadata** with inventory value summary
- **Seed data** loads automatically on first run

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
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

- Next.js (App Router)
- React 19
- SQLite via `better-sqlite3`
- TypeScript + Tailwind CSS
