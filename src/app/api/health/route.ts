import { NextResponse } from "next/server";
import { ensureAppReady } from "@/lib/bootstrap";

export const runtime = "nodejs";

export async function GET() {
  try {
    ensureAppReady();
    return NextResponse.json({
      ok: true,
      service: "assetledger",
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: "Database unavailable" },
      { status: 503 }
    );
  }
}
