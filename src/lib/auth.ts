import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import type { SessionUser, UserRole } from "./types";

export const SESSION_COOKIE = "assetledger_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getAuthSecret() {
  const secret =
    process.env.AUTH_SECRET ||
    "assetledger-dev-secret-change-me-in-production";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub: String(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getAuthSecret());
}

export async function readSessionToken(
  token: string | undefined | null
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    if (
      !payload.sub ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return {
      id: Number(payload.sub),
      name: payload.name,
      email: payload.email,
      role: payload.role as UserRole,
      department:
        typeof payload.department === "string" ? payload.department : "",
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUser(
  request: NextRequest
): Promise<SessionUser | null> {
  return readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export function canManageUsers(role: UserRole) {
  return role === "admin";
}

export function canEditAssets(role: UserRole) {
  return role === "admin" || role === "editor";
}

export function unauthorized(message = "Authentication required") {
  return Response.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Insufficient permissions") {
  return Response.json({ error: message }, { status: 403 });
}
