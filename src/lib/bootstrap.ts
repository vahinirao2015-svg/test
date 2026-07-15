import { seedIfEmpty } from "@/lib/db";
import { seedUsersIfEmpty } from "@/lib/users";

export function ensureAppReady() {
  seedUsersIfEmpty();
  seedIfEmpty();
}
