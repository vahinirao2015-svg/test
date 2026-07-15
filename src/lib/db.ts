import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type { Asset, AssetFilters, AssetInput, AssetStats } from "./types";

const DB_PATH =
  process.env.DATABASE_PATH ||
  path.join(process.cwd(), "data", "inventory.db");

declare global {
  // Persist the SQLite connection across hot reloads in development.
  var __inventoryDb: Database.Database | undefined;
}

function ensureDbDirectory() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createConnection() {
  ensureDbDirectory();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_tag TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      manufacturer TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      serial_number TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Available',
      assigned_to TEXT NOT NULL DEFAULT '',
      assigned_email TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      purchase_date TEXT,
      warranty_expiry TEXT,
      purchase_cost REAL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
    CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department);
  `);
  return db;
}

export function getDb() {
  if (!global.__inventoryDb) {
    global.__inventoryDb = createConnection();
  }
  return global.__inventoryDb;
}

type AssetRow = {
  id: number;
  asset_tag: string;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  status: string;
  assigned_to: string;
  assigned_email: string;
  department: string;
  location: string;
  purchase_date: string | null;
  warranty_expiry: string | null;
  purchase_cost: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

function mapRow(row: AssetRow): Asset {
  return {
    id: row.id,
    assetTag: row.asset_tag,
    name: row.name,
    category: row.category as Asset["category"],
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number,
    status: row.status as Asset["status"],
    assignedTo: row.assigned_to,
    assignedEmail: row.assigned_email,
    department: row.department,
    location: row.location,
    purchaseDate: row.purchase_date,
    warrantyExpiry: row.warranty_expiry,
    purchaseCost: row.purchase_cost,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listAssets(filters: AssetFilters = {}): Asset[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: Record<string, string> = {};

  if (filters.search?.trim()) {
    clauses.push(`(
      asset_tag LIKE @search OR
      name LIKE @search OR
      manufacturer LIKE @search OR
      model LIKE @search OR
      serial_number LIKE @search OR
      assigned_to LIKE @search OR
      location LIKE @search
    )`);
    params.search = `%${filters.search.trim()}%`;
  }

  if (filters.category && filters.category !== "all") {
    clauses.push("category = @category");
    params.category = filters.category;
  }

  if (filters.status && filters.status !== "all") {
    clauses.push("status = @status");
    params.status = filters.status;
  }

  if (filters.department && filters.department !== "all") {
    clauses.push("department = @department");
    params.department = filters.department;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT * FROM assets ${where} ORDER BY updated_at DESC, id DESC`
    )
    .all(params) as AssetRow[];

  return rows.map(mapRow);
}

export function getAssetById(id: number): Asset | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;
  return row ? mapRow(row) : null;
}

export function getAssetStats(): AssetStats {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN status = 'In Repair' THEN 1 ELSE 0 END) as inRepair,
        SUM(CASE WHEN status = 'Retired' THEN 1 ELSE 0 END) as retired,
        SUM(CASE WHEN status = 'Lost' THEN 1 ELSE 0 END) as lost,
        COALESCE(SUM(purchase_cost), 0) as totalValue
      FROM assets
    `
    )
    .get() as {
    total: number;
    available: number;
    assigned: number;
    inRepair: number;
    retired: number;
    lost: number;
    totalValue: number;
  };

  return {
    total: row.total ?? 0,
    available: row.available ?? 0,
    assigned: row.assigned ?? 0,
    inRepair: row.inRepair ?? 0,
    retired: row.retired ?? 0,
    lost: row.lost ?? 0,
    totalValue: row.totalValue ?? 0,
  };
}

export function getDepartments(): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT department FROM assets
       WHERE department IS NOT NULL AND department != ''
       ORDER BY department ASC`
    )
    .all() as { department: string }[];
  return rows.map((row) => row.department);
}

export function createAsset(input: AssetInput): Asset {
  const db = getDb();
  const result = db
    .prepare(
      `
      INSERT INTO assets (
        asset_tag, name, category, manufacturer, model, serial_number,
        status, assigned_to, assigned_email, department, location,
        purchase_date, warranty_expiry, purchase_cost, notes
      ) VALUES (
        @assetTag, @name, @category, @manufacturer, @model, @serialNumber,
        @status, @assignedTo, @assignedEmail, @department, @location,
        @purchaseDate, @warrantyExpiry, @purchaseCost, @notes
      )
    `
    )
    .run({
      assetTag: input.assetTag.trim(),
      name: input.name.trim(),
      category: input.category,
      manufacturer: input.manufacturer.trim(),
      model: input.model.trim(),
      serialNumber: input.serialNumber.trim(),
      status: input.status,
      assignedTo: input.assignedTo.trim(),
      assignedEmail: input.assignedEmail.trim(),
      department: input.department.trim(),
      location: input.location.trim(),
      purchaseDate: input.purchaseDate || null,
      warrantyExpiry: input.warrantyExpiry || null,
      purchaseCost: input.purchaseCost ?? null,
      notes: input.notes.trim(),
    });

  const created = getAssetById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("Failed to load created asset");
  }
  return created;
}

export function updateAsset(id: number, input: AssetInput): Asset | null {
  const db = getDb();
  const existing = getAssetById(id);
  if (!existing) return null;

  db.prepare(
    `
    UPDATE assets SET
      asset_tag = @assetTag,
      name = @name,
      category = @category,
      manufacturer = @manufacturer,
      model = @model,
      serial_number = @serialNumber,
      status = @status,
      assigned_to = @assignedTo,
      assigned_email = @assignedEmail,
      department = @department,
      location = @location,
      purchase_date = @purchaseDate,
      warranty_expiry = @warrantyExpiry,
      purchase_cost = @purchaseCost,
      notes = @notes,
      updated_at = datetime('now')
    WHERE id = @id
  `
  ).run({
    id,
    assetTag: input.assetTag.trim(),
    name: input.name.trim(),
    category: input.category,
    manufacturer: input.manufacturer.trim(),
    model: input.model.trim(),
    serialNumber: input.serialNumber.trim(),
    status: input.status,
    assignedTo: input.assignedTo.trim(),
    assignedEmail: input.assignedEmail.trim(),
    department: input.department.trim(),
    location: input.location.trim(),
    purchaseDate: input.purchaseDate || null,
    warrantyExpiry: input.warrantyExpiry || null,
    purchaseCost: input.purchaseCost ?? null,
    notes: input.notes.trim(),
  });

  return getAssetById(id);
}

export function deleteAsset(id: number): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM assets WHERE id = ?").run(id);
  return result.changes > 0;
}

export function seedIfEmpty() {
  const db = getDb();
  const count = (
    db.prepare("SELECT COUNT(*) as count FROM assets").get() as {
      count: number;
    }
  ).count;

  if (count > 0) return;

  const samples: AssetInput[] = [
    {
      assetTag: "IT-1001",
      name: "MacBook Pro 14",
      category: "Laptop",
      manufacturer: "Apple",
      model: "MacBook Pro 14 M3",
      serialNumber: "C02YXabcd123",
      status: "Assigned",
      assignedTo: "Asha Patel",
      assignedEmail: "asha.patel@example.com",
      department: "Engineering",
      location: "HQ Floor 3",
      purchaseDate: "2024-03-12",
      warrantyExpiry: "2027-03-12",
      purchaseCost: 2399,
      notes: "Primary developer laptop",
    },
    {
      assetTag: "IT-1002",
      name: "ThinkPad X1 Carbon",
      category: "Laptop",
      manufacturer: "Lenovo",
      model: "X1 Carbon Gen 11",
      serialNumber: "PF3ABCDE",
      status: "Available",
      assignedTo: "",
      assignedEmail: "",
      department: "IT",
      location: "IT Store Room",
      purchaseDate: "2024-06-01",
      warrantyExpiry: "2027-06-01",
      purchaseCost: 1899,
      notes: "Spare pool",
    },
    {
      assetTag: "IT-2001",
      name: "Dell UltraSharp 27",
      category: "Monitor",
      manufacturer: "Dell",
      model: "U2723QE",
      serialNumber: "CN0ABCD123",
      status: "Assigned",
      assignedTo: "Marcus Chen",
      assignedEmail: "marcus.chen@example.com",
      department: "Design",
      location: "HQ Floor 2",
      purchaseDate: "2023-11-20",
      warrantyExpiry: "2026-11-20",
      purchaseCost: 649,
      notes: "",
    },
    {
      assetTag: "IT-3001",
      name: "iPhone 15",
      category: "Phone",
      manufacturer: "Apple",
      model: "iPhone 15 128GB",
      serialNumber: "DNXXYZ1234",
      status: "Assigned",
      assignedTo: "Jordan Lee",
      assignedEmail: "jordan.lee@example.com",
      department: "Sales",
      location: "Remote",
      purchaseDate: "2024-01-08",
      warrantyExpiry: "2025-01-08",
      purchaseCost: 799,
      notes: "Company mobile",
    },
    {
      assetTag: "IT-4001",
      name: "Cisco Catalyst Switch",
      category: "Network",
      manufacturer: "Cisco",
      model: "C9300-48T",
      serialNumber: "FCW2345A001",
      status: "Assigned",
      assignedTo: "Network Ops",
      assignedEmail: "netops@example.com",
      department: "IT",
      location: "Server Room A",
      purchaseDate: "2022-09-15",
      warrantyExpiry: "2027-09-15",
      purchaseCost: 5200,
      notes: "Core access switch",
    },
    {
      assetTag: "IT-5001",
      name: "Dell PowerEdge R760",
      category: "Server",
      manufacturer: "Dell",
      model: "PowerEdge R760",
      serialNumber: "SRV760X100",
      status: "In Repair",
      assignedTo: "Infra Team",
      assignedEmail: "infra@example.com",
      department: "IT",
      location: "Datacenter Rack 12",
      purchaseDate: "2023-05-22",
      warrantyExpiry: "2028-05-22",
      purchaseCost: 12500,
      notes: "PSU replacement scheduled",
    },
    {
      assetTag: "IT-6001",
      name: "Microsoft 365 E3",
      category: "Software License",
      manufacturer: "Microsoft",
      model: "M365 E3 Annual",
      serialNumber: "LIC-M365-E3-2025",
      status: "Assigned",
      assignedTo: "Company Wide",
      assignedEmail: "itadmin@example.com",
      department: "IT",
      location: "Cloud",
      purchaseDate: "2025-01-01",
      warrantyExpiry: "2025-12-31",
      purchaseCost: 8400,
      notes: "50 seats",
    },
    {
      assetTag: "IT-7001",
      name: "Logitech MX Keys",
      category: "Peripheral",
      manufacturer: "Logitech",
      model: "MX Keys S",
      serialNumber: "MXK-99881",
      status: "Retired",
      assignedTo: "",
      assignedEmail: "",
      department: "IT",
      location: "Surplus Closet",
      purchaseDate: "2021-04-10",
      warrantyExpiry: "2023-04-10",
      purchaseCost: 119,
      notes: "End of life",
    },
  ];

  const insert = db.transaction((items: AssetInput[]) => {
    for (const item of items) {
      createAsset(item);
    }
  });

  insert(samples);
}
