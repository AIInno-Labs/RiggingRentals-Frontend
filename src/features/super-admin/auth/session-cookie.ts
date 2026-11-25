/**
 * Super Admin session = the Rigg Rental backend JWT, kept in an httpOnly
 * cookie. Shared by the middleware (edge), Server Actions and Route Handlers,
 * so nothing here may import "server-only" or Node APIs.
 */

export const SA_SESSION_COOKIE = "rr_sa_session";

/** Treat the token as expired this long before its real `exp`. */
const EXPIRY_MARGIN_MS = 60_000;

/**
 * Reads the JWT's `exp` claim without verifying the signature. Only used to
 * avoid sending an already-expired token; the backend still verifies it.
 */
export function isTokenFresh(token: string): boolean {
  const payload = token.split(".")[1];
  if (!payload) return false;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === "number" && exp * 1000 - EXPIRY_MARGIN_MS > Date.now();
  } catch {
    return false;
  }
}
