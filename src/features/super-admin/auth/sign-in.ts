import "server-only";
import { authenticate, request } from "@/features/super-admin/api/http/client";
import { type BackendUser, isSuperAdmin } from "@/features/super-admin/api/rigg-rental-shared";
import { clearSessionToken, setSessionToken } from "@/features/super-admin/auth/session";

export type SuperAdminSignIn =
  /** Signed in; the session cookie is set. */
  | { status: "signed-in" }
  /** Not a Super Admin on the backend (wrong password, unknown email, or a tenant user). */
  | { status: "not-super-admin" }
  /** Backend not configured or not reachable. */
  | { status: "unavailable" };

/**
 * Tries the shared login page's credentials against the Rigg Rental backend.
 * Only the platform Super Admin is signed in here; anyone else is left to the
 * staff (Supabase) sign-in. Must run in a Server Action (it sets a cookie).
 */
export async function signInSuperAdmin(email: string, password: string): Promise<SuperAdminSignIn> {
  if (!process.env.RIGG_RENTAL_API_URL) return { status: "unavailable" };
  try {
    const auth = await authenticate(email, password);
    if (!auth) return { status: "not-super-admin" };

    const me = await request<BackendUser>("GET", "/auth/me", { token: auth.token });
    if (!isSuperAdmin(me)) return { status: "not-super-admin" };

    await setSessionToken(auth.token, auth.expiresIn);
    return { status: "signed-in" };
  } catch (error) {
    console.warn("[super-admin] backend sign-in unavailable", error);
    return { status: "unavailable" };
  }
}

/** Ends the Super Admin session. Server Action / Route Handler only. */
export async function signOutSuperAdmin(): Promise<void> {
  await clearSessionToken();
}
