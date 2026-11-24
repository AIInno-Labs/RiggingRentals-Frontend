import type {
  AustralianState,
  EmailGroupId,
  EmailRecipient,
  PrivilegeType,
} from "@/features/super-admin/types";

/** Australian states and the time zone each one sets for hire dates. */
export const STATE_TIME_ZONES: Record<AustralianState, string> = {
  WA: "Australia/Perth",
  NT: "Australia/Darwin",
  SA: "Australia/Adelaide",
  QLD: "Australia/Brisbane",
  NSW: "Australia/Sydney",
  ACT: "Australia/Sydney",
  VIC: "Australia/Melbourne",
  TAS: "Australia/Hobart",
};

export const AUSTRALIAN_STATES = Object.keys(STATE_TIME_ZONES) as AustralianState[];

export const PRIVILEGE_TYPES: Record<PrivilegeType, { label: string; meaning: string; className: string }> = {
  MENU: {
    label: "Menu",
    meaning: "Shows a screen in the menu.",
    className: "border-sky-700/40 bg-sky-100 text-sky-950",
  },
  ACTION: {
    label: "Action",
    meaning: "Lets a person do something.",
    className: "border-border bg-zinc-100 text-zinc-700",
  },
  FIELD: {
    label: "Field",
    meaning: "Lets a person see sensitive values.",
    className: "border-violet-700/40 bg-violet-100 text-violet-950",
  },
};

export const PRIVILEGE_TYPE_ORDER: PrivilegeType[] = ["MENU", "ACTION", "FIELD"];

/** Email sections, in display order. */
export const EMAIL_GROUPS: { id: EmailGroupId; title: string; subtitle: string }[] = [
  { id: "sales", title: "Sales", subtitle: "Sent to customers" },
  { id: "logistics", title: "Yard & logistics", subtitle: "Sent to customers" },
  { id: "finance", title: "Finance", subtitle: "Sent to customers" },
  {
    id: "compliance",
    title: "Fleet & compliance",
    subtitle: "Sent to the organization's Admin, so lifting gear is re-certified before it's needed for dispatch",
  },
];

export const EMAIL_RECIPIENT_LABELS: Record<EmailRecipient, string> = {
  customer: "Customer contact",
  accounts: "Customer accounts email",
  rep: "Sales rep on the order",
  orgAdmin: "Organization Admin",
  orgAccounts: "Organization accounts inbox",
};

/** Fields staff can insert into an email; filled in when the email is sent. */
export const EMAIL_TEMPLATE_VARIABLES = [
  "contact_name",
  "customer_name",
  "order_number",
  "invoice_number",
  "hire_start",
  "hire_end",
  "quote_valid_until",
  "jobsite",
  "customer_po",
  "offhire_date",
  "org_name",
  "org_phone",
  "cert_count",
  "amount_due",
  "due_date",
  "company_name",
  "accounts_email",
  "bsb",
  "account",
] as const;

export type EmailTemplateVariable = (typeof EMAIL_TEMPLATE_VARIABLES)[number];

/** Sample customer/order values used only for the email preview. */
export const EMAIL_PREVIEW_SAMPLE = {
  contact_name: "Jordan Price",
  customer_name: "Pilbara Civil Contractors",
  hire_start: "25/11/2026",
  hire_end: "09/12/2026",
  quote_valid_until: "23/12/2026",
  jobsite: "Burrup Peninsula, Karratha WA",
  customer_po: "PO-77812",
  offhire_date: "09/12/2026",
  cert_count: "4",
  amount_due: "$4,862.00",
  due_date: "31/01/2027",
  orderSuffix: "1042",
  invoiceSuffix: "INV-0418",
} as const;

export const VALIDATION = {
  organizationCode: /^[A-Z]{2,5}$/,
  privilegeCode: /^[A-Z][A-Z0-9_]{2,39}$/,
  httpsUrl: /^https:\/\/\S+$/,
  mfaCode: /^\d{6}$/,
  minPasswordLength: 8,
  emailDaysMin: 1,
  emailDaysMax: 90,
} as const;
