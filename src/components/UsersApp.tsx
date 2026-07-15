"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { AppShell } from "@/components/AppShell";
import type { SessionUser, User, UserInput, UserRole } from "@/lib/types";

export function UsersApp({ user }: { user: SessionUser }) {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [search, setSearch] = useState("");
  const [deferredSearch, setDeferredSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<User | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => setDeferredSearch(search), 250);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ includeInactive: "1" });
        if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
        const response = await fetch(`/api/users?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          users?: User[];
          roles?: UserRole[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error || "Failed to load users");
        setUsers(data.users || []);
        setRoles(data.roles || []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void run();
    return () => controller.abort();
  }, [deferredSearch, reloadToken]);

  function openCreate() {
    setMode("create");
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(target: User) {
    setMode("edit");
    setEditing(target);
    setModalOpen(true);
  }

  async function handleSubmit(input: UserInput) {
    const url = mode === "create" ? "/api/users" : `/api/users/${editing?.id}`;
    const method = mode === "create" ? "POST" : "PUT";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to save user");
    setReloadToken((token) => token + 1);
  }

  async function handleDelete(target: User) {
    const confirmed = window.confirm(
      `Delete user ${target.name} (${target.email})?`
    );
    if (!confirmed) return;
    const response = await fetch(`/api/users/${target.id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error || "Unable to delete user");
      return;
    }
    setReloadToken((token) => token + 1);
  }

  return (
    <AppShell user={user}>
      <header className="topbar">
        <div className="brand-block">
          <p className="brand-mark">AssetLedger</p>
          <h1>User management</h1>
          <p className="lede">
            Create accounts, assign roles, and control who can edit inventory.
          </p>
        </div>
        <button type="button" className="primary-btn" onClick={openCreate}>
          Add user
        </button>
      </header>

      <section className="toolbar single">
        <label className="search-field">
          <span className="sr-only">Search users</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, department..."
          />
        </label>
      </section>

      {error ? <p className="banner-error">{error}</p> : null}

      <section className="table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>{item.email}</td>
                    <td>
                      <span className={`role-badge role-${item.role}`}>
                        {item.role}
                      </span>
                    </td>
                    <td>{item.department || "—"}</td>
                    <td>{item.active ? "Active" : "Inactive"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="ghost-btn compact"
                          onClick={() => openEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger-btn compact"
                          onClick={() => void handleDelete(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <UserFormModal
        open={modalOpen}
        mode={mode}
        initial={editing}
        roles={roles}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}

function UserFormModal({
  open,
  mode,
  initial,
  roles,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: User | null;
  roles: UserRole[];
  onClose: () => void;
  onSubmit: (input: UserInput) => Promise<void>;
}) {
  if (!open) return null;
  return (
    <UserFormModalInner
      key={`${mode}-${initial?.id ?? "new"}`}
      mode={mode}
      initial={initial}
      roles={roles}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function UserFormModalInner({
  mode,
  initial,
  roles,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial: User | null;
  roles: UserRole[];
  onClose: () => void;
  onSubmit: (input: UserInput) => Promise<void>;
}) {
  const titleId = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState<UserRole>(initial?.role ?? "viewer");
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name,
        email,
        role,
        department,
        active,
        password: password || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Account</p>
            <h2 id={titleId}>{mode === "create" ? "Add user" : "Edit user"}</h2>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <form className="asset-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Name *
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Email *
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Role *
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Department
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </label>
            <label>
              {mode === "create" ? "Password *" : "New password"}
              <input
                type="password"
                required={mode === "create"}
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "edit" ? "Leave blank to keep current" : ""}
              />
            </label>
            <label className="checkbox-field">
              <span>Active</span>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
            </label>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="form-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? "Saving..." : mode === "create" ? "Save user" : "Update user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
