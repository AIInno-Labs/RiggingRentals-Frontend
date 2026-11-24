import { getCurrentProfile } from "@/features/rbac/get-current-profile";
import {
  canManageFleet,
  canMutateLogistics,
} from "@/features/rbac/route-access";
import type { AppRole } from "@/features/rbac/types";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

export async function requireProfile(): Promise<
  ActionResult<{ id: string; role: AppRole }>
> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return fail("FORBIDDEN", "Sign in required");
  }
  return ok({ id: profile.id, role: profile.role });
}

export async function requireFleetAdmin(): Promise<
  ActionResult<{ id: string; role: AppRole }>
> {
  const profile = await requireProfile();
  if (!profile.success) return profile;
  if (!canManageFleet(profile.data.role)) {
    return fail(
      "FORBIDDEN",
      "Only an administrator can change fleet models, serials, or certificates",
    );
  }
  return profile;
}

export async function requireLogisticsMutator(): Promise<
  ActionResult<{ id: string; role: AppRole }>
> {
  const profile = await requireProfile();
  if (!profile.success) return profile;
  if (!canMutateLogistics(profile.data.role)) {
    return fail(
      "FORBIDDEN",
      "Your role cannot update delivery or pickup tasks",
    );
  }
  return profile;
}
