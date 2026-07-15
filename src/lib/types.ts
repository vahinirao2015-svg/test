export const ASSET_CATEGORIES = [
  "Laptop",
  "Desktop",
  "Monitor",
  "Phone",
  "Tablet",
  "Server",
  "Network",
  "Peripheral",
  "Software License",
  "Other",
] as const;

export const ASSET_STATUSES = [
  "Available",
  "Assigned",
  "In Repair",
  "Retired",
  "Lost",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export interface Asset {
  id: number;
  assetTag: string;
  name: string;
  category: AssetCategory;
  manufacturer: string;
  model: string;
  serialNumber: string;
  status: AssetStatus;
  assignedTo: string;
  assignedEmail: string;
  department: string;
  location: string;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  purchaseCost: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type AssetInput = Omit<Asset, "id" | "createdAt" | "updatedAt">;

export interface AssetStats {
  total: number;
  available: number;
  assigned: number;
  inRepair: number;
  retired: number;
  lost: number;
  totalValue: number;
}

export interface AssetFilters {
  search?: string;
  category?: string;
  status?: string;
  department?: string;
}
