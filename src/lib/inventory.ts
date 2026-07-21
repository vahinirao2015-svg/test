export { ASSET_CATEGORIES, ASSET_STATUSES } from "./types";
export type {
  Asset,
  AssetCategory,
  AssetFilters,
  AssetInput,
  AssetStats,
  AssetStatus,
} from "./types";

import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  type AssetInput,
} from "./types";

export function validateAssetInput(body: Partial<AssetInput>): string | null {
  if (!body.assetTag?.trim()) return "Asset tag is required";
  if (!body.name?.trim()) return "Name is required";
  if (!body.category || !ASSET_CATEGORIES.includes(body.category)) {
    return "Valid category is required";
  }
  if (!body.status || !ASSET_STATUSES.includes(body.status)) {
    return "Valid status is required";
  }
  if (
    body.purchaseCost !== null &&
    body.purchaseCost !== undefined &&
    Number.isNaN(Number(body.purchaseCost))
  ) {
    return "Purchase cost must be a number";
  }
  return null;
}

export function normalizeAssetInput(body: Partial<AssetInput>): AssetInput {
  return {
    assetTag: body.assetTag?.trim() ?? "",
    name: body.name?.trim() ?? "",
    category: body.category as AssetInput["category"],
    manufacturer: body.manufacturer?.trim() ?? "",
    model: body.model?.trim() ?? "",
    serialNumber: body.serialNumber?.trim() ?? "",
    status: body.status as AssetInput["status"],
    assignedTo: body.assignedTo?.trim() ?? "",
    assignedEmail: body.assignedEmail?.trim() ?? "",
    department: body.department?.trim() ?? "",
    location: body.location?.trim() ?? "",
    purchaseDate: body.purchaseDate || null,
    warrantyExpiry: body.warrantyExpiry || null,
    purchaseCost:
      body.purchaseCost === null || body.purchaseCost === undefined
        ? null
        : Number(body.purchaseCost),
    notes: body.notes?.trim() ?? "",
  };
}

export function emptyAssetInput(): AssetInput {
  return {
    assetTag: "",
    name: "",
    category: "Laptop",
    manufacturer: "",
    model: "",
    serialNumber: "",
    status: "Available",
    assignedTo: "",
    assignedEmail: "",
    department: "",
    location: "",
    purchaseDate: null,
    warrantyExpiry: null,
    purchaseCost: null,
    notes: "",
  };
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
