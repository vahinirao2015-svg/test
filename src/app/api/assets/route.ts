import { NextRequest, NextResponse } from "next/server";
import {
  createAsset,
  getAssetStats,
  getDepartments,
  listAssets,
  seedIfEmpty,
} from "@/lib/db";
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  type AssetInput,
} from "@/lib/types";
import { normalizeAssetInput, validateAssetInput } from "@/lib/inventory";

export const runtime = "nodejs";

function ensureReady() {
  seedIfEmpty();
}

export async function GET(request: NextRequest) {
  try {
    ensureReady();
    const { searchParams } = new URL(request.url);
    const include = searchParams.get("include");

    if (include === "meta") {
      return NextResponse.json({
        assets: listAssets({
          search: searchParams.get("search") ?? undefined,
          category: searchParams.get("category") ?? undefined,
          status: searchParams.get("status") ?? undefined,
          department: searchParams.get("department") ?? undefined,
        }),
        stats: getAssetStats(),
        departments: getDepartments(),
        categories: ASSET_CATEGORIES,
        statuses: ASSET_STATUSES,
      });
    }

    const assets = listAssets({
      search: searchParams.get("search") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      department: searchParams.get("department") ?? undefined,
    });

    return NextResponse.json({ assets });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load assets" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureReady();
    const body = (await request.json()) as Partial<AssetInput>;
    const validationError = validateAssetInput(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const asset = createAsset(normalizeAssetInput(body));
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create asset";
    if (message.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "Asset tag already exists" },
        { status: 409 }
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}
