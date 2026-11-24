/**
 * Domain types for the Super Admin panel.
 *
 * These mirror the shapes the backend API returns (see
 * docs/super-admin-api-contract.md). Pages and components only ever use these
 * types, never a backend- or mock-specific shape.
 */

/* ---------- shared ---------- */

export type ActiveStatus = "active" | "inactive";
export type StatusFilter = ActiveStatus | "all";

/** Parameters and emails are read and written at one of these two levels. */
export type ScopeMode = "platform" | "organization";

/* ---------- organizations ---------- */

export type AustralianState = "WA" | "NT" | "SA" | "QLD" | "NSW" | "ACT" | "VIC" | "TAS";

export type OrganizationAdmin = {
  name: string;
  email: string;
  phone: string;
};

export type Organization = {
  id: string;
  code: string;
  name: string;
  state: AustralianState;
  address: string;
  phone: string;
  email: string;
  active: boolean;
  createdAt: string; // ISO date (YYYY-MM-DD)
  admin: OrganizationAdmin;
};

/** List row: the organization plus set-up counts the lists and dashboard show. */
export type OrganizationSummary = Organization & {
  parameterOverrideCount: number;
  customEmailCount: number;
};

/** Side panel: list row plus figures only the detail view needs. */
export type OrganizationDetail = OrganizationSummary & {
  missingParameterCount: number;
  emailsOnCount: number;
};

export type OrganizationFilters = {
  q?: string;
  status?: StatusFilter;
};

export type OrganizationInput = {
  name: string;
  code: string;
  state: AustralianState;
  address: string;
  phone: string;
  email: string;
};

export type CreateOrganizationInput = OrganizationInput & {
  admin: OrganizationAdmin & { temporaryPassword: string };
};

/** Minimal shape for organization pickers. */
export type OrganizationOption = Pick<Organization, "id" | "code" | "name" | "active">;

/* ---------- privileges ---------- */

export type PrivilegeType = "MENU" | "ACTION" | "FIELD";

export type Privilege = {
  code: string;
  label: string;
  type: PrivilegeType;
  area: string;
  description: string;
  active: boolean;
  createdAt: string;
};

export type PrivilegeFilters = {
  q?: string;
  type?: PrivilegeType | "all";
  status?: StatusFilter;
};

export type PrivilegeList = {
  items: Privilege[];
  total: number;
  countsByType: Record<PrivilegeType, number>;
  areas: string[];
};

export type CreatePrivilegeInput = Omit<Privilege, "active" | "createdAt">;
export type UpdatePrivilegeInput = Omit<CreatePrivilegeInput, "code">;

/* ---------- application parameters ---------- */

export type ParameterValueType = "boolean" | "text" | "secret" | "url" | "email" | "number" | "select";
export type ParameterValue = string | number | boolean;

export type ParameterDefinition = {
  key: string;
  label: string;
  type: ParameterValueType;
  required: boolean;
  /** Show the value in a monospace font (IDs, URLs, patterns). */
  monospace: boolean;
  hint?: string;
  options?: string[];
  min?: number;
  max?: number;
  /** Text shown next to 0 for numeric limits, e.g. "no limit". */
  zeroMeans?: string;
};

/**
 * A parameter as seen at a given scope. Secret values are never sent to the
 * browser: only `maskedValue` and `hasValue` are.
 */
export type ParameterView = ParameterDefinition & {
  value: ParameterValue | null;
  maskedValue: string | null;
  hasValue: boolean;
  /** Where the value comes from at this scope. */
  source: "platform" | "organization";
  /** Platform value, for organization scope (masked for secrets). */
  platformDisplay: ParameterValue | null;
  /** Codes of organizations with their own value (platform scope only). */
  overriddenBy: string[];
  missing: boolean;
};

export type ParameterGroupId = "sharepoint" | "ai" | "email";

export type ParameterGroupView = {
  id: ParameterGroupId;
  name: string;
  description: string;
  enabled: boolean;
  missingCount: number;
  items: ParameterView[];
};

export type ParameterScope = { organizationId?: string };

export type ConnectionTestResult = { ok: boolean; message: string };

/* ---------- notification emails ---------- */

export type EmailGroupId = "sales" | "logistics" | "finance" | "compliance";

export type EmailRecipient = "customer" | "accounts" | "rep" | "orgAdmin" | "orgAccounts";

export type EmailSendMode = "auto" | "manual";

export type EmailTemplate = {
  id: string;
  group: EmailGroupId;
  name: string;
  trigger: string;
  enabled: boolean;
  mode: EmailSendMode;
  /** Whether staff can choose between auto and manual sending. */
  modeSelectable: boolean;
  timing: { days: number; label: string } | null;
  recipients: EmailRecipient[];
  attachment: string;
  /** Recipients this email may go to (internal emails have fewer options). */
  allowedRecipients: EmailRecipient[];
  adminCanTurnOff: boolean;
  subject: string;
  body: string;
  /** True when the selected organization has its own version. */
  custom: boolean;
};

export type UpdateEmailTemplateInput = {
  subject: string;
  body: string;
  recipients: EmailRecipient[];
  days?: number;
  mode?: EmailSendMode;
  /** Platform scope only. */
  adminCanTurnOff?: boolean;
};

/** Values the email preview needs to look like a real sent email. */
export type EmailPreviewContext = {
  fromName: string;
  fromAddress: string;
  replyTo: string;
  organization: Pick<Organization, "name" | "code" | "address" | "phone" | "email">;
};

/* ---------- dashboard ---------- */

export type DashboardSummary = {
  organizations: { active: number; inactive: number; total: number };
  privileges: { active: number; inactive: number };
  services: { enabled: string[]; total: number };
  parameterOverrides: { total: number; organizations: number };
  missingParameters: number;
  emails: { on: number; total: number; customisedOrganizations: number };
};

/* ---------- profile ---------- */

export type SuperAdminProfile = {
  name: string;
  email: string;
  mobile: string;
  mfaEnabled: boolean;
};

export type UpdateProfileInput = { name: string; mobile: string };
export type ChangePasswordInput = { currentPassword: string; newPassword: string };
export type MfaSetup = { secret: string; otpauthUri: string };
