import "server-only";
import { ApiError } from "@/features/super-admin/api/contract";

/**
 * No real per-admin sign-in exists yet for this panel (see
 * docs/super-admin-api-contract.md: "Authentication isn't wired yet"). This
 * logs in once, server-side, as the seeded platform Super Admin and reuses
 * the token until it's close to expiring.
 *
 * Used by the server-side adapter (http/rigg-rental-api.ts) directly, and by
 * app/api/super-admin/token/route.ts to hand the resulting JWT to the
 * browser for direct backend calls — the Super Admin password itself never
 * reaches client-side JS, only this derived, time-limited token.
 */

function apiUrl(): string {
  const url = process.env.RIGG_RENTAL_API_URL?.replace(/\/$/, "");
  if (!url) throw new ApiError("UNAVAILABLE", "RIGG_RENTAL_API_URL is not set.", 503);
  return url;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getServiceToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const email = process.env.RIGG_RENTAL_SUPERADMIN_EMAIL ?? "superadmin@rigg-rental.local";
  const password = process.env.RIGG_RENTAL_SUPERADMIN_PASSWORD ?? "superadmin123";

  let res: Response;
  try {
    res = await fetch(`${apiUrl()}/auth/authenticate`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new ApiError("UNAVAILABLE", "The Rigg Rental API can't be reached.", 503);
  }
  if (!res.ok) {
    throw new ApiError("UNAVAILABLE", "Could not sign in to the Rigg Rental API as Super Admin.", 503);
  }
  const body = (await res.json()) as { token: string; expiresIn: number };
  cachedToken = { value: body.token, expiresAt: Date.now() + body.expiresIn - 60_000 };
  return cachedToken.value;
}
