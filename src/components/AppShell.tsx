"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/types";

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <div className="app-nav">
        <div className="app-nav-links">
          <Link
            href="/"
            className={pathname === "/" ? "nav-link active" : "nav-link"}
          >
            Inventory
          </Link>
          {user.role === "admin" ? (
            <Link
              href="/users"
              className={
                pathname.startsWith("/users") ? "nav-link active" : "nav-link"
              }
            >
              Users
            </Link>
          ) : null}
        </div>
        <div className="app-nav-user">
          <div>
            <strong>{user.name}</strong>
            <span>
              {user.role} · {user.email}
            </span>
          </div>
          <button type="button" className="ghost-btn compact" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
