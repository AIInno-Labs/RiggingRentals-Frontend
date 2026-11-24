import type {
  ChangePasswordInput,
  ConnectionTestResult,
  CreateOrganizationInput,
  CreatePrivilegeInput,
  DashboardSummary,
  EmailPreviewContext,
  EmailTemplate,
  MfaSetup,
  OrganizationDetail,
  OrganizationFilters,
  OrganizationInput,
  OrganizationOption,
  OrganizationSummary,
  ParameterGroupId,
  ParameterGroupView,
  ParameterScope,
  PrivilegeFilters,
  PrivilegeList,
  SuperAdminProfile,
  UpdateEmailTemplateInput,
  UpdatePrivilegeInput,
  UpdateProfileInput,
} from "@/features/super-admin/types";

/**
 * Everything the Super Admin panel needs from the backend.
 *
 * Two implementations exist:
 *  - `mock/`  in-memory sample data (used now)
 *  - `http/`  calls the Spring Boot API (switched on with SUPER_ADMIN_API_MODE=http)
 *
 * The REST endpoint for each method is listed beside it and in
 * docs/super-admin-api-contract.md.
 */
export interface SuperAdminApi {
  /** GET /platform/dashboard */
  getDashboardSummary(): Promise<DashboardSummary>;
  /** GET /platform/nav-badges */
  getNavBadges(): Promise<{ parameters: number }>;

  /** GET /platform/organizations?q=&status= */
  listOrganizations(filters?: OrganizationFilters): Promise<OrganizationSummary[]>;
  /** GET /platform/organizations/options */
  listOrganizationOptions(): Promise<OrganizationOption[]>;
  /** GET /platform/organizations/{id} */
  getOrganization(id: string): Promise<OrganizationDetail>;
  /** POST /platform/organizations */
  createOrganization(input: CreateOrganizationInput): Promise<OrganizationSummary>;
  /** PUT /platform/organizations/{id} */
  updateOrganization(id: string, input: OrganizationInput): Promise<OrganizationSummary>;
  /** PATCH /platform/organizations/{id}/status  { active } */
  setOrganizationActive(id: string, active: boolean): Promise<OrganizationSummary>;
  /** POST /platform/organizations/{id}/admin/password-reset */
  resetOrganizationAdminPassword(id: string): Promise<{ email: string }>;

  /** GET /platform/privileges?q=&type=&status= */
  listPrivileges(filters?: PrivilegeFilters): Promise<PrivilegeList>;
  /** POST /platform/privileges */
  createPrivilege(input: CreatePrivilegeInput): Promise<void>;
  /** PUT /platform/privileges/{code} */
  updatePrivilege(code: string, input: UpdatePrivilegeInput): Promise<void>;
  /** PATCH /platform/privileges/{code}/status  { active } */
  setPrivilegeActive(code: string, active: boolean): Promise<void>;

  /** GET /platform/parameters?organizationId= */
  getParameters(scope?: ParameterScope): Promise<ParameterGroupView[]>;
  /** PUT /platform/parameters/{key}?organizationId=  { value } */
  updateParameter(key: string, rawValue: string, scope?: ParameterScope): Promise<void>;
  /** DELETE /platform/parameters/{key}?organizationId=  (organization only) */
  resetParameter(key: string, organizationId: string): Promise<void>;
  /** POST /platform/parameters/{group}/test?organizationId= */
  testParameterGroup(group: ParameterGroupId, scope?: ParameterScope): Promise<ConnectionTestResult>;

  /** GET /platform/notifications?organizationId= */
  listEmailTemplates(scope?: ParameterScope): Promise<EmailTemplate[]>;
  /** PUT /platform/notifications/{id}?organizationId= */
  updateEmailTemplate(id: string, input: UpdateEmailTemplateInput, scope?: ParameterScope): Promise<void>;
  /** PATCH /platform/notifications/{id}/enabled?organizationId=  { enabled } */
  setEmailEnabled(id: string, enabled: boolean, scope?: ParameterScope): Promise<void>;
  /** DELETE /platform/notifications/{id}?organizationId=  (organization only) */
  resetEmailTemplate(id: string, organizationId: string): Promise<void>;
  /** POST /platform/notifications/{id}/test?organizationId= */
  sendTestEmail(id: string, scope?: ParameterScope): Promise<{ sentTo: string }>;
  /** GET /platform/notifications/preview-context?organizationId= */
  getEmailPreviewContext(scope?: ParameterScope): Promise<EmailPreviewContext>;

  /** GET /me */
  getProfile(): Promise<SuperAdminProfile>;
  /** PUT /me */
  updateProfile(input: UpdateProfileInput): Promise<void>;
  /** POST /me/password */
  changePassword(input: ChangePasswordInput): Promise<void>;
  /** POST /me/mfa/setup */
  startMfaSetup(): Promise<MfaSetup>;
  /** POST /me/mfa/confirm  { code } */
  confirmMfa(code: string): Promise<void>;
  /** DELETE /me/mfa */
  disableMfa(): Promise<void>;
}

export type ApiErrorCode = "VALIDATION" | "CONFLICT" | "NOT_FOUND" | "FORBIDDEN" | "UNAVAILABLE" | "UNKNOWN";

/** Error thrown by any API implementation; `message` is safe to show users. */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
