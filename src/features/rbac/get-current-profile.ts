import { createClient } from "@/lib/supabase/server";
import { fetchProfileViaRpc } from "@/features/rbac/fetch-profile";
import type { Profile } from "@/features/rbac/types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return fetchProfileViaRpc(supabase);
}
