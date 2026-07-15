import { getDb } from "./db";
import { hashPassword } from "./password";
import type { User, UserInput, UserRole } from "./types";
import { USER_ROLES } from "./types";

type UserRow = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  department: string;
  active: number;
  created_at: string;
  updated_at: string;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    department: row.department,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function ensureUsersSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      department TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  `);
}

export function listUsers(search?: string): User[] {
  ensureUsersSchema();
  const db = getDb();
  if (search?.trim()) {
    const rows = db
      .prepare(
        `SELECT * FROM users
         WHERE name LIKE @search OR email LIKE @search OR department LIKE @search
         ORDER BY name ASC`
      )
      .all({ search: `%${search.trim()}%` }) as UserRow[];
    return rows.map(mapUser);
  }

  const rows = db
    .prepare(`SELECT * FROM users ORDER BY name ASC`)
    .all() as UserRow[];
  return rows.map(mapUser);
}

export function getUserById(id: number): User | null {
  ensureUsersSchema();
  const row = getDb()
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(id) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function getUserByEmail(email: string): (User & { passwordHash: string }) | null {
  ensureUsersSchema();
  const row = getDb()
    .prepare(`SELECT * FROM users WHERE lower(email) = lower(?)`)
    .get(email.trim()) as UserRow | undefined;
  if (!row) return null;
  return { ...mapUser(row), passwordHash: row.password_hash };
}

export function countUsers(): number {
  ensureUsersSchema();
  const row = getDb()
    .prepare(`SELECT COUNT(*) as count FROM users`)
    .get() as { count: number };
  return row.count;
}

export function createUser(input: UserInput & { password: string }): User {
  ensureUsersSchema();
  if (!USER_ROLES.includes(input.role)) {
    throw new Error("Invalid role");
  }
  if (!input.password || input.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const result = getDb()
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, department, active)
       VALUES (@name, @email, @passwordHash, @role, @department, @active)`
    )
    .run({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash: hashPassword(input.password),
      role: input.role,
      department: input.department.trim(),
      active: input.active ? 1 : 0,
    });

  const created = getUserById(Number(result.lastInsertRowid));
  if (!created) throw new Error("Failed to create user");
  return created;
}

export function updateUser(
  id: number,
  input: UserInput
): User | null {
  ensureUsersSchema();
  const existing = getUserById(id);
  if (!existing) return null;
  if (!USER_ROLES.includes(input.role)) {
    throw new Error("Invalid role");
  }

  if (input.password) {
    if (input.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    getDb()
      .prepare(
        `UPDATE users SET
          name = @name,
          email = @email,
          role = @role,
          department = @department,
          active = @active,
          password_hash = @passwordHash,
          updated_at = datetime('now')
         WHERE id = @id`
      )
      .run({
        id,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        role: input.role,
        department: input.department.trim(),
        active: input.active ? 1 : 0,
        passwordHash: hashPassword(input.password),
      });
  } else {
    getDb()
      .prepare(
        `UPDATE users SET
          name = @name,
          email = @email,
          role = @role,
          department = @department,
          active = @active,
          updated_at = datetime('now')
         WHERE id = @id`
      )
      .run({
        id,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        role: input.role,
        department: input.department.trim(),
        active: input.active ? 1 : 0,
      });
  }

  return getUserById(id);
}

export function deleteUser(id: number): boolean {
  ensureUsersSchema();
  const result = getDb().prepare(`DELETE FROM users WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function seedUsersIfEmpty() {
  ensureUsersSchema();
  if (countUsers() > 0) return;

  const defaults: Array<UserInput & { password: string }> = [
    {
      name: "System Admin",
      email: "admin@assetledger.local",
      role: "admin",
      department: "IT",
      active: true,
      password: "Admin123!",
    },
    {
      name: "Asha Patel",
      email: "asha.patel@example.com",
      role: "editor",
      department: "Engineering",
      active: true,
      password: "Editor123!",
    },
    {
      name: "Marcus Chen",
      email: "marcus.chen@example.com",
      role: "viewer",
      department: "Design",
      active: true,
      password: "Viewer123!",
    },
    {
      name: "Jordan Lee",
      email: "jordan.lee@example.com",
      role: "viewer",
      department: "Sales",
      active: true,
      password: "Viewer123!",
    },
  ];

  for (const user of defaults) {
    createUser(user);
  }
}
