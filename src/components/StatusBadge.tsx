"use client";

import type { AssetStatus } from "@/lib/types";

const STATUS_CLASS: Record<AssetStatus, string> = {
  Available: "status-available",
  Assigned: "status-assigned",
  "In Repair": "status-repair",
  Retired: "status-retired",
  Lost: "status-lost",
};

export function StatusBadge({ status }: { status: AssetStatus }) {
  return <span className={`status-badge ${STATUS_CLASS[status]}`}>{status}</span>;
}
