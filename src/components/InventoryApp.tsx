"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AssetFormModal } from "@/components/AssetFormModal";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/inventory";
import type {
  Asset,
  AssetCategory,
  AssetInput,
  AssetStats,
  AssetStatus,
} from "@/lib/types";

interface InventoryPayload {
  assets: Asset[];
  stats: AssetStats;
  departments: string[];
  categories: AssetCategory[];
  statuses: AssetStatus[];
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

export function InventoryApp() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<AssetStats>(EMPTY_STATS);
  const [departments, setDepartments] = useState<string[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [statuses, setStatuses] = useState<AssetStatus[]>([]);
  const [search, setSearch] = useState("");
  const [deferredSearch, setDeferredSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Asset | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setDeferredSearch(search), 250);
    return () => window.clearTimeout(handle);
  }, [search]);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ include: "meta" });
      if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
      if (category !== "all") params.set("category", category);
      if (status !== "all") params.set("status", status);
      if (department !== "all") params.set("department", department);

      const response = await fetch(`/api/assets?${params.toString()}`);
      const data = (await response.json()) as InventoryPayload & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to load inventory");
      }

      setAssets(data.assets);
      setStats(data.stats);
      setDepartments(data.departments);
      setCategories(data.categories);
      setStatuses(data.statuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [deferredSearch, category, status, department]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

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
    await loadInventory();
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
    await loadInventory();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="brand-mark">AssetLedger</p>
          <h1>IT Inventory</h1>
          <p className="lede">
            Track hardware, licenses, ownership, and location in one place.
          </p>
        </div>
        <button type="button" className="primary-btn" onClick={openCreate}>
          Add asset
        </button>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    Loading inventory...
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-cell">
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
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
