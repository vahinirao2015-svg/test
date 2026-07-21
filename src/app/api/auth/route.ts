import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookie,
  createSessionToken,
  getSessionUser,
  setSessionCookie,
  unauthorized,
} from "@/lib/auth";
import { ensureAppReady } from "@/lib/bootstrap";
import { verifyPassword } from "@/lib/password";
import { getUserByEmail } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    ensureAppReady();
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (!body.email?.trim() || !body.password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = getUserByEmail(body.email);
    if (!user || !user.active) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!verifyPassword(body.password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    };
    const token = await createSessionToken(sessionUser);
    const response = NextResponse.json({ user: sessionUser });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}

export async function GET(request: NextRequest) {
  ensureAppReady();
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  return NextResponse.json({ user });
}
