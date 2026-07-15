"use client";

import { useId, useState } from "react";
import type { Asset, AssetCategory, AssetInput, AssetStatus } from "@/lib/types";
import { emptyAssetInput } from "@/lib/inventory";

interface AssetFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: Asset | null;
  categories: readonly AssetCategory[];
  statuses: readonly AssetStatus[];
  onClose: () => void;
  onSubmit: (input: AssetInput) => Promise<void>;
}

function toFormValues(initial?: Asset | null): AssetInput {
  if (!initial) return emptyAssetInput();
  return {
    assetTag: initial.assetTag,
    name: initial.name,
    category: initial.category,
    manufacturer: initial.manufacturer,
    model: initial.model,
    serialNumber: initial.serialNumber,
    status: initial.status,
    assignedTo: initial.assignedTo,
    assignedEmail: initial.assignedEmail,
    department: initial.department,
    location: initial.location,
    purchaseDate: initial.purchaseDate,
    warrantyExpiry: initial.warrantyExpiry,
    purchaseCost: initial.purchaseCost,
    notes: initial.notes,
  };
}

export function AssetFormModal({
  open,
  mode,
  initial,
  categories,
  statuses,
  onClose,
  onSubmit,
}: AssetFormModalProps) {
  if (!open) return null;

  return (
    <AssetFormModalInner
      key={`${mode}-${initial?.id ?? "new"}`}
      mode={mode}
      initial={initial}
      categories={categories}
      statuses={statuses}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function AssetFormModalInner({
  mode,
  initial,
  categories,
  statuses,
  onClose,
  onSubmit,
}: Omit<AssetFormModalProps, "open">) {
  const titleId = useId();
  const [form, setForm] = useState<AssetInput>(() => toFormValues(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof AssetInput>(key: K, value: AssetInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save asset");
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
            <p className="eyebrow">Inventory record</p>
            <h2 id={titleId}>{mode === "create" ? "Add asset" : "Edit asset"}</h2>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="asset-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Asset tag *
              <input
                required
                value={form.assetTag}
                onChange={(e) => update("assetTag", e.target.value)}
                placeholder="IT-1001"
              />
            </label>
            <label>
              Name *
              <input
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="MacBook Pro 14"
              />
            </label>
            <label>
              Category *
              <select
                value={form.category}
                onChange={(e) =>
                  update("category", e.target.value as AssetCategory)
                }
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status *
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value as AssetStatus)}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Manufacturer
              <input
                value={form.manufacturer}
                onChange={(e) => update("manufacturer", e.target.value)}
              />
            </label>
            <label>
              Model
              <input
                value={form.model}
                onChange={(e) => update("model", e.target.value)}
              />
            </label>
            <label>
              Serial number
              <input
                value={form.serialNumber}
                onChange={(e) => update("serialNumber", e.target.value)}
              />
            </label>
            <label>
              Department
              <input
                value={form.department}
                onChange={(e) => update("department", e.target.value)}
              />
            </label>
            <label>
              Assigned to
              <input
                value={form.assignedTo}
                onChange={(e) => update("assignedTo", e.target.value)}
              />
            </label>
            <label>
              Assigned email
              <input
                type="email"
                value={form.assignedEmail}
                onChange={(e) => update("assignedEmail", e.target.value)}
              />
            </label>
            <label>
              Location
              <input
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
              />
            </label>
            <label>
              Purchase cost (USD)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchaseCost ?? ""}
                onChange={(e) =>
                  update(
                    "purchaseCost",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
              />
            </label>
            <label>
              Purchase date
              <input
                type="date"
                value={form.purchaseDate ?? ""}
                onChange={(e) => update("purchaseDate", e.target.value || null)}
              />
            </label>
            <label>
              Warranty expiry
              <input
                type="date"
                value={form.warrantyExpiry ?? ""}
                onChange={(e) =>
                  update("warrantyExpiry", e.target.value || null)
                }
              />
            </label>
          </div>

          <label className="notes-field">
            Notes
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Maintenance notes, accessories, license seats..."
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="form-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? "Saving..." : mode === "create" ? "Save asset" : "Update asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
