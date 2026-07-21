import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { InventoryApp } from "@/components/InventoryApp";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { ensureAppReady } from "@/lib/bootstrap";

export default async function Home() {
  ensureAppReady();
  const cookieStore = await cookies();
  const user = await readSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login");
  return <InventoryApp user={user} />;
}
