export const APP_ROLES = [
  "super_admin",
  "sales",
  "workshop",
  "finance",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type Profile = {
  id: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}
