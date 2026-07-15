import { NextRequest, NextResponse } from "next/server";
import {
  canManageUsers,
  forbidden,
  getSessionUser,
  unauthorized,
} from "@/lib/auth";
import { ensureAppReady } from "@/lib/bootstrap";
import { USER_ROLES, type UserInput, type UserRole } from "@/lib/types";
import { createUser, listUsers } from "@/lib/users";

export const runtime = "nodejs";

function validateUserInput(
  body: Partial<UserInput>,
  { requirePassword }: { requirePassword: boolean }
): string | null {
  if (!body.name?.trim()) return "Name is required";
  if (!body.email?.trim()) return "Email is required";
  if (!body.role || !USER_ROLES.includes(body.role)) return "Valid role is required";
  if (requirePassword && (!body.password || body.password.length < 8)) {
    return "Password must be at least 8 characters";
  }
  if (body.password && body.password.length < 8) {
    return "Password must be at least 8 characters";
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    ensureAppReady();
    const actor = await getSessionUser(request);
    if (!actor) return unauthorized();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;

    // Editors/viewers can list active users for asset assignment pickers.
    // Full directory (including inactive) is admin-only via includeInactive.
    const includeInactive = searchParams.get("includeInactive") === "1";
    if (includeInactive && !canManageUsers(actor.role)) {
      return forbidden();
    }

    let users = listUsers(search);
    if (!includeInactive) {
      users = users.filter((user) => user.active);
    }

    return NextResponse.json({
      users,
      roles: USER_ROLES,
      canManage: canManageUsers(actor.role),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureAppReady();
    const actor = await getSessionUser(request);
    if (!actor) return unauthorized();
    if (!canManageUsers(actor.role)) return forbidden();

    const body = (await request.json()) as Partial<UserInput>;
    const validationError = validateUserInput(body, { requirePassword: true });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const user = createUser({
      name: body.name!.trim(),
      email: body.email!.trim(),
      role: body.role as UserRole,
      department: body.department?.trim() ?? "",
      active: body.active !== false,
      password: body.password!,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    if (message.includes("UNIQUE")) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
