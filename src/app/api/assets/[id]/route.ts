import { NextRequest, NextResponse } from "next/server";
import { deleteAsset, getAssetById, updateAsset } from "@/lib/db";
import {
  canEditAssets,
  forbidden,
  getSessionUser,
  unauthorized,
} from "@/lib/auth";
import { ensureAppReady } from "@/lib/bootstrap";
import type { AssetInput } from "@/lib/types";
import { normalizeAssetInput, validateAssetInput } from "@/lib/inventory";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    ensureAppReady();
    const actor = await getSessionUser(request);
    if (!actor) return unauthorized();

    const { id } = await context.params;
    const assetId = Number(id);
    if (!Number.isInteger(assetId)) {
      return NextResponse.json({ error: "Invalid asset id" }, { status: 400 });
    }

    const asset = getAssetById(assetId);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load asset" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    ensureAppReady();
    const actor = await getSessionUser(request);
    if (!actor) return unauthorized();
    if (!canEditAssets(actor.role)) return forbidden();

    const { id } = await context.params;
    const assetId = Number(id);
    if (!Number.isInteger(assetId)) {
      return NextResponse.json({ error: "Invalid asset id" }, { status: 400 });
    }

    const body = (await request.json()) as Partial<AssetInput>;
    const validationError = validateAssetInput(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const asset = updateAsset(assetId, normalizeAssetInput(body));
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update asset";
    if (message.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "Asset tag already exists" },
        { status: 409 }
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    ensureAppReady();
    const actor = await getSessionUser(request);
    if (!actor) return unauthorized();
    if (!canEditAssets(actor.role)) return forbidden();

    const { id } = await context.params;
    const assetId = Number(id);
    if (!Number.isInteger(assetId)) {
      return NextResponse.json({ error: "Invalid asset id" }, { status: 400 });
    }

    const deleted = deleteAsset(assetId);
    if (!deleted) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
