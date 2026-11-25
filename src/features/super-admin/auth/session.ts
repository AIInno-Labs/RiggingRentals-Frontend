import "server-only";
import { cookies } from "next/headers";
import { SA_SESSION_COOKIE, isTokenFresh } from "@/features/super-admin/auth/session-cookie";

/** The signed-in Super Admin's backend JWT, or null when there is no valid session. */
export async function getSessionToken(): Promise<string | null> {
  const token = (await cookies()).get(SA_SESSION_COOKIE)?.value;
  return token && isTokenFresh(token) ? token : null;
}

/** Only callable from a Server Action or Route Handler. */
export async function setSessionToken(token: string, expiresInMs: number): Promise<void> {
  (await cookies()).set(SA_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, Math.floor(expiresInMs / 1000)),
  });
}

/** Only callable from a Server Action or Route Handler. */
export async function clearSessionToken(): Promise<void> {
  (await cookies()).delete(SA_SESSION_COOKIE);
}
