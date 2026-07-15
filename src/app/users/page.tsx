import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UsersApp } from "@/components/UsersApp";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { ensureAppReady } from "@/lib/bootstrap";

export default async function UsersPage() {
  ensureAppReady();
  const cookieStore = await cookies();
  const user = await readSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return <UsersApp user={user} />;
}
