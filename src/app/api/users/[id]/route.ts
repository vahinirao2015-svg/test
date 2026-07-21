import { NextRequest, NextResponse } from "next/server";
import {
  canManageUsers,
  forbidden,
  getSessionUser,
  unauthorized,
} from "@/lib/auth";
import { ensureAppReady } from "@/lib/bootstrap";
import { USER_ROLES, type UserInput, type UserRole } from "@/lib/types";
import { deleteUser, getUserById, updateUser } from "@/lib/users";

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
    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const user = getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.active && !canManageUsers(actor.role) && actor.id !== user.id) {
      return forbidden();
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
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
    if (!canManageUsers(actor.role)) return forbidden();

    const { id } = await context.params;
    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const body = (await request.json()) as Partial<UserInput>;
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!body.email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!body.role || !USER_ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Valid role is required" }, { status: 400 });
    }
    if (body.password && body.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Prevent locking yourself out of admin.
    if (actor.id === userId && body.role !== "admin") {
      return NextResponse.json(
        { error: "You cannot remove your own admin role" },
        { status: 400 }
      );
    }
    if (actor.id === userId && body.active === false) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 }
      );
    }

    const user = updateUser(userId, {
      name: body.name.trim(),
      email: body.email.trim(),
      role: body.role as UserRole,
      department: body.department?.trim() ?? "",
      active: body.active !== false,
      password: body.password,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    if (message.includes("UNIQUE")) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
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
    if (!canManageUsers(actor.role)) return forbidden();

    const { id } = await context.params;
    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    if (actor.id === userId) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const deleted = deleteUser(userId);
    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
