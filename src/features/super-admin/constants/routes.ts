export const SUPER_ADMIN_BASE = "/super-admin";

export const SA_ROUTES = {
  dashboard: SUPER_ADMIN_BASE,
  organizations: `${SUPER_ADMIN_BASE}/organizations`,
  privileges: `${SUPER_ADMIN_BASE}/privileges`,
  parameters: `${SUPER_ADMIN_BASE}/parameters`,
  notifications: `${SUPER_ADMIN_BASE}/notifications`,
  profile: `${SUPER_ADMIN_BASE}/profile`,
} as const;

/** Where "Sign out" goes until the backend provides a Super Admin session. */
export const SIGN_OUT_HREF = "/login";

/** Query-string keys shared by pages, links and filters. */
export const QUERY = {
  search: "q",
  status: "status",
  type: "type",
  scope: "scope",
  organization: "org",
  /** Opens the "Create organization" dialog on arrival. */
  create: "new",
} as const;

export type NavItem = {
  href: string;
  label: string;
  /** Shorter label for the mobile bottom bar. */
  shortLabel: string;
  /** Key into the nav badge counts. */
  badgeKey?: "parameters";
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: SA_ROUTES.dashboard, label: "Home", shortLabel: "Home" },
  { href: SA_ROUTES.organizations, label: "Organizations", shortLabel: "Orgs" },
  { href: SA_ROUTES.privileges, label: "Privileges", shortLabel: "Privileges" },
  { href: SA_ROUTES.parameters, label: "Parameters", shortLabel: "Parameters", badgeKey: "parameters" },
  { href: SA_ROUTES.notifications, label: "Notifications", shortLabel: "Emails" },
  { href: SA_ROUTES.profile, label: "My profile", shortLabel: "Profile" },
];
