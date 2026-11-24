"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/features/auth/schemas";
import { fetchProfileViaRpc } from "@/features/rbac/fetch-profile";
import { homePathForRole } from "@/features/rbac/route-access";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

export async function loginAction(
  input: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid input",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return fail("AUTH_ERROR", error.message);
  }

  const profile = await fetchProfileViaRpc(supabase);
  if (!profile) {
    return fail(
      "PROFILE_MISSING",
      "No rental profile found for this user.",
    );
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return fail("INACTIVE", "Your account is inactive. Contact an administrator.");
  }

  const jar = await cookies();
  jar.set("rr_role", profile.role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return ok({ redirectTo: homePathForRole(profile.role) });
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const jar = await cookies();
  jar.delete("rr_role");
  redirect("/login");
}
