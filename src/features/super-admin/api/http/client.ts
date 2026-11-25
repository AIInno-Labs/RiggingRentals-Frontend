import "server-only";
import { ApiError, type ApiErrorCode } from "@/features/super-admin/api/contract";
import { getSessionToken } from "@/features/super-admin/auth/session";

/**
 * The one place that talks HTTP to the Rigg Rental Spring Boot API.
 *
 * Every call is made as the signed-in Super Admin: the JWT comes from the
 * session cookie set by the login page (see features/auth/actions.ts). To
 * wire a new endpoint, call `request()` from the matching http/ module.
 */

type Query = Record<string, string | number | undefined | null>;

export type RequestOptions = {
  query?: Query;
  body?: unknown;
  /** Use this token instead of the session's (only during sign-in). */
  token?: string;
};

export function apiUrl(): string {
  const url = process.env.RIGG_RENTAL_API_URL?.replace(/\/$/, "");
  if (!url) throw new ApiError("UNAVAILABLE", "RIGG_RENTAL_API_URL is not set.", 503);
  return url;
}

const STATUS_CODES: Record<number, ApiErrorCode> = {
  400: "VALIDATION",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION",
};

/** Backend error bodies: `{ error }`, or `{ validationErrors, errors }` for bean validation. */
type BackendErrorBody = { error?: string; validationErrors?: string[] } | null;

export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.token ?? (await getSessionToken());
  if (!token) throw new ApiError("UNAUTHENTICATED", SESSION_EXPIRED_MESSAGE, 401);

  const url = new URL(`${apiUrl()}${path}`);
  Object.entries(options.query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("UNAVAILABLE", "The Rigg Rental API can't be reached.", 503);
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as BackendErrorBody;
    const code = STATUS_CODES[res.status] ?? "UNKNOWN";
    const message =
      code === "UNAUTHENTICATED"
        ? SESSION_EXPIRED_MESSAGE
        : (payload?.error ?? payload?.validationErrors?.[0] ?? "The request failed.");
    throw new ApiError(code, message, res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

/**
 * POST /auth/authenticate. Returns null for wrong credentials, so the login
 * page can fall back to the staff (Supabase) sign-in.
 */
export async function authenticate(email: string, password: string): Promise<{ token: string; expiresIn: number } | null> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl()}/auth/authenticate`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new ApiError("UNAVAILABLE", "The Rigg Rental API can't be reached.", 503);
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new ApiError("UNAVAILABLE", "The Rigg Rental API couldn't sign you in.", 503);
  return (await res.json()) as { token: string; expiresIn: number };
}
