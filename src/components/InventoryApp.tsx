"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AppShell } from "@/components/AppShell";
import { AssetFormModal } from "@/components/AssetFormModal";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/inventory";
import type {
  Asset,
  AssetCategory,
  AssetInput,
  AssetStats,
  AssetStatus,
  SessionUser,
  User,
} from "@/lib/types";

interface InventoryPayload {
  assets: Asset[];
  stats: AssetStats;
  departments: string[];
  categories: AssetCategory[];
  statuses: AssetStatus[];
  canEdit?: boolean;
}

const EMPTY_STATS: AssetStats = {
  total: 0,
  available: 0,
  assigned: 0,
  inRepair: 0,
  retired: 0,
  lost: 0,
  totalValue: 0,
};

export function InventoryApp({ user }: { user: SessionUser }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<AssetStats>(EMPTY_STATS);
  const [departments, setDepartments] = useState<string[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [statuses, setStatuses] = useState<AssetStatus[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<User[]>([]);
  const [canEdit, setCanEdit] = useState(user.role !== "viewer");
  const [search, setSearch] = useState("");
  const [deferredSearch, setDeferredSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("all");
  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Asset | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const handle = window.setTimeout(() => {
      startTransition(() => setDeferredSearch(search));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [search, startTransition]);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ include: "meta" });
        if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
        if (category !== "all") params.set("category", category);
        if (status !== "all") params.set("status", status);
        if (department !== "all") params.set("department", department);

        const [inventoryResponse, usersResponse] = await Promise.all([
          fetch(`/api/assets?${params.toString()}`, {
            signal: controller.signal,
          }),
          fetch("/api/users", { signal: controller.signal }),
        ]);

        const data = (await inventoryResponse.json()) as InventoryPayload & {
          error?: string;
        };
        if (!inventoryResponse.ok) {
          throw new Error(data.error || "Failed to load inventory");
        }

        setAssets(data.assets);
        setStats(data.stats);
        setDepartments(data.departments);
        setCategories(data.categories);
        setStatuses(data.statuses);
        setCanEdit(Boolean(data.canEdit));

        if (usersResponse.ok) {
          const usersData = (await usersResponse.json()) as { users?: User[] };
          setAssignableUsers(usersData.users || []);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load inventory");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void run();
    return () => controller.abort();
  }, [deferredSearch, category, status, department, reloadToken]);

  const summaryCards = useMemo(
    () => [
      { label: "Total assets", value: String(stats.total) },
      { label: "Available", value: String(stats.available) },
      { label: "Assigned", value: String(stats.assigned) },
      { label: "In repair", value: String(stats.inRepair) },
      { label: "Inventory value", value: formatCurrency(stats.totalValue) },
    ],
    [stats]
  );

  function refresh() {
    setReloadToken((token) => token + 1);
  }

  function openCreate() {
    setModalMode("create");
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(asset: Asset) {
    setModalMode("edit");
    setEditing(asset);
    setModalOpen(true);
  }

  async function handleSubmit(input: AssetInput) {
    const url =
      modalMode === "create" ? "/api/assets" : `/api/assets/${editing?.id}`;
    const method = modalMode === "create" ? "POST" : "PUT";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Unable to save asset");
    }
    refresh();
  }

  async function handleDelete(asset: Asset) {
    const confirmed = window.confirm(
      `Delete asset ${asset.assetTag} (${asset.name})? This cannot be undone.`
    );
    if (!confirmed) return;

    const response = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error || "Unable to delete asset");
      return;
    }
    refresh();
  }

  return (
    <AppShell user={user}>
      <header className="topbar">
        <div className="brand-block">
          <p className="brand-mark">AssetLedger</p>
          <h1>IT Inventory</h1>
          <p className="lede">
            Track hardware, licenses, ownership, and location in one place.
          </p>
        </div>
        {canEdit ? (
          <button type="button" className="primary-btn" onClick={openCreate}>
            Add asset
          </button>
        ) : null}
      </header>

      <section className="summary-row" aria-label="Inventory summary">
        {summaryCards.map((card) => (
          <article key={card.label} className="summary-item">
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="toolbar" aria-label="Filters">
        <label className="search-field">
          <span className="sr-only">Search assets</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tag, name, serial, assignee..."
          />
        </label>
        <label>
          <span className="sr-only">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Department</span>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="all">All departments</option>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? <p className="banner-error">{error}</p> : null}

      <section className="table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tag</th>
                <th>Asset</th>
                <th>Category</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Location</th>
                <th>Cost</th>
                <th>Warranty</th>
                {canEdit ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canEdit ? 9 : 8} className="empty-cell">
                    Loading inventory...
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 9 : 8} className="empty-cell">
                    No assets match your filters. Add a record to populate the
                    inventory.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <code className="asset-tag">{asset.assetTag}</code>
                    </td>
                    <td>
                      <div className="asset-name">
                        <strong>{asset.name}</strong>
                        <span>
                          {[asset.manufacturer, asset.model]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </div>
                    </td>
                    <td>{asset.category}</td>
                    <td>
                      <StatusBadge status={asset.status} />
                    </td>
                    <td>
                      <div className="asset-name">
                        <strong>{asset.assignedTo || "Unassigned"}</strong>
                        <span>{asset.department || "—"}</span>
                      </div>
                    </td>
                    <td>{asset.location || "—"}</td>
                    <td>{formatCurrency(asset.purchaseCost)}</td>
                    <td>{formatDate(asset.warrantyExpiry)}</td>
                    {canEdit ? (
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="ghost-btn compact"
                            onClick={() => openEdit(asset)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="danger-btn compact"
                            onClick={() => void handleDelete(asset)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AssetFormModal
        open={modalOpen}
        mode={modalMode}
        initial={editing}
        categories={categories}
        statuses={statuses}
        assignableUsers={assignableUsers}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}
