import { isAppRole, type Profile } from "@/features/rbac/types";

type ProfilePayload = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type RpcCapableClient = {
  schema: (schema: string) => {
    rpc: (fn: string) => PromiseLike<{
      data: unknown;
      error: { message: string } | null;
    }>;
  };
};

function toProfile(row: ProfilePayload): Profile | null {
  if (!isAppRole(row.role)) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Reads rental.profiles via public RPC (works before rental schema is API-exposed). */
export async function fetchProfileViaRpc(
  supabase: RpcCapableClient,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .schema("public")
    .rpc("rental_get_my_profile");

  if (error || data === null || typeof data !== "object") {
    return null;
  }

  return toProfile(data as ProfilePayload);
}
