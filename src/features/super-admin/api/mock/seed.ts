import type {
  EmailTemplate,
  Organization,
  ParameterDefinition,
  ParameterGroupId,
  ParameterValue,
  Privilege,
  PrivilegeType,
  UpdateEmailTemplateInput,
} from "@/features/super-admin/types";

/**
 * Sample data for the mock API. Shapes match what the backend will store,
 * so this file doubles as an example payload for the backend team.
 */

export type ParameterGroupRecord = {
  id: ParameterGroupId;
  name: string;
  description: string;
  /** The first item is the group's on/off switch. */
  items: ParameterDefinition[];
};

export type EmailTemplateRecord = Omit<EmailTemplate, "custom">;
export type EmailOverride = Partial<Pick<EmailTemplateRecord, "enabled" | "subject" | "body" | "recipients" | "mode">> &
  Pick<UpdateEmailTemplateInput, "days">;

export type MockDatabase = {
  organizations: Organization[];
  privileges: Privilege[];
  parameterGroups: ParameterGroupRecord[];
  platformParameters: Record<string, ParameterValue>;
  organizationParameters: Record<string, Record<string, ParameterValue>>;
  emailTemplates: EmailTemplateRecord[];
  organizationEmails: Record<string, Record<string, EmailOverride>>;
  profile: { name: string; email: string; mobile: string; password: string; mfaEnabled: boolean; pendingMfaSecret: string | null };
};

const p = (def: Partial<ParameterDefinition> & Pick<ParameterDefinition, "key" | "label" | "type">): ParameterDefinition => ({
  required: false,
  monospace: false,
  ...def,
});

const PARAMETER_GROUPS: ParameterGroupRecord[] = [
  {
    id: "sharepoint",
    name: "SharePoint",
    description: "Where order documents, job photos and signed dockets are filed.",
    items: [
      p({ key: "SHAREPOINT_ENABLED", label: "File documents to SharePoint", type: "boolean" }),
      p({ key: "SHAREPOINT_TENANT_ID", label: "Tenant ID", type: "text", required: true, monospace: true, hint: "Microsoft 365 directory (tenant) ID." }),
      p({ key: "SHAREPOINT_CLIENT_ID", label: "App (client) ID", type: "text", required: true, monospace: true, hint: "From the app registration in Microsoft Entra." }),
      p({ key: "SHAREPOINT_CLIENT_SECRET", label: "Client secret", type: "secret", required: true }),
      p({ key: "SHAREPOINT_SITE_URL", label: "Site URL", type: "url", required: true, monospace: true, hint: "e.g. https://riggingrentals.sharepoint.com/sites/Operations" }),
      p({ key: "SHAREPOINT_LIBRARY", label: "Document library", type: "text" }),
      p({ key: "SHAREPOINT_FOLDER_PATTERN", label: "Folder pattern", type: "text", monospace: true, hint: "You can use {org_code}, {year} and {order_number}." }),
    ],
  },
  {
    id: "ai",
    name: "AI",
    description: "AI assistant that drafts quotes, emails and job notes.",
    items: [
      p({ key: "AI_ENABLED", label: "AI assistant", type: "boolean" }),
      p({ key: "AI_PROVIDER", label: "Provider", type: "select", options: ["Anthropic", "OpenAI", "Azure OpenAI"] }),
      p({ key: "AI_MODEL", label: "Model", type: "text", required: true, monospace: true }),
      p({ key: "AI_API_KEY", label: "API key", type: "secret", required: true }),
      p({ key: "AI_MAX_TOKENS", label: "Max response length (tokens)", type: "number", min: 256, max: 32000 }),
      p({ key: "AI_MONTHLY_LIMIT", label: "Monthly request limit", type: "number", min: 0, max: 1_000_000, zeroMeans: "no limit", hint: "0 means no limit." }),
    ],
  },
  {
    id: "email",
    name: "Email",
    description: "Service that sends quotes, invoices and reminders.",
    items: [
      p({ key: "EMAIL_ENABLED", label: "Send emails", type: "boolean", hint: "When off, staff get an “open in your email app” link instead." }),
      p({ key: "EMAIL_PROVIDER", label: "Provider", type: "select", options: ["Resend", "SMTP"] }),
      p({ key: "EMAIL_API_KEY", label: "API key", type: "secret", required: true }),
      p({ key: "EMAIL_FROM_NAME", label: "From name", type: "text", required: true }),
      p({ key: "EMAIL_FROM_ADDRESS", label: "From address", type: "email", required: true, hint: "Must be on a domain verified with the email service." }),
      p({ key: "EMAIL_REPLY_TO", label: "Reply-to address", type: "email", hint: "Leave empty to send replies to the From address." }),
      p({ key: "EMAIL_DAILY_LIMIT", label: "Daily send limit", type: "number", min: 0, max: 100_000, zeroMeans: "no limit", hint: "0 means no limit." }),
    ],
  },
];

const PRIVILEGE_SEED: [area: string, type: PrivilegeType, items: [code: string, label: string][]][] = [
  ["Menus", "MENU", [
    ["MENU_OPS_HOME", "Ops Home dashboard"], ["MENU_ENQUIRIES", "Enquiries"], ["MENU_ORDERS", "Quotes & orders"],
    ["MENU_CUSTOMERS", "Customers"], ["MENU_AVAILABILITY", "Availability"], ["MENU_CATALOG", "Catalog"],
    ["MENU_LOGISTICS", "Logistics"], ["MENU_MAINTENANCE", "Maintenance"], ["MENU_WORKSHOP", "Workshop jobs"],
    ["MENU_REPAIRS", "Repair bay"], ["MENU_BILLING", "Billing"],
  ]],
  ["Enquiries", "ACTION", [["LEAD_WRITE", "Create / edit enquiries"], ["LEAD_CONVERT", "Convert enquiry to customer & quote"], ["COMM_LOG", "Log calls & emails"]]],
  ["Customers", "ACTION", [["CUSTOMER_WRITE", "Create / edit customers"], ["CUSTOMER_CREDIT_EDIT", "Change cash/credit, limit & terms"], ["CUSTOMER_ON_STOP", "Put account on stop / release"]]],
  ["Quotes & orders", "ACTION", [
    ["QUOTE_WRITE", "Create / edit quotes"], ["QUOTE_SEND", "Send quotes"], ["RATE_OVERRIDE", "Override line rates"],
    ["TNC_ACCEPT_RECORD", "Record hire T&C acceptance"], ["PAYMENT_RECORD", "Record deposit / payment"],
    ["ORDER_CONFIRM", "Confirm order (locks stock)"], ["ORDER_CANCEL", "Cancel order"], ["OFF_HIRE_REQUEST", "Request off-hire"],
  ]],
  ["Fleet", "ACTION", [["CATALOG_MANAGE", "Manage catalog & rates"], ["ASSET_MANAGE", "Manage serials"], ["CERT_MANAGE", "Manage certificates"]]],
  ["Workshop", "ACTION", [
    ["PICK_ASSIGN", "Assign serials & pack"], ["DISPATCH", "Dispatch"], ["DISPATCH_REVERT", "Revert dispatch"],
    ["CERT_OVERRIDE", "Override expired certificate"], ["RETURN_QC", "Return QC & fees"],
    ["ORDER_MARK_RETURNED", "Mark order returned"], ["JOB_FILES_UPLOAD", "Upload job files & photos"],
  ]],
  ["Logistics", "ACTION", [["LOGISTICS_UPDATE", "Update deliveries, pickups & POD"]]],
  ["Maintenance", "ACTION", [["WORK_ORDER_WRITE", "Create / update work orders"]]],
  ["Billing", "ACTION", [
    ["INVOICE_COMPILE", "Compile invoices"], ["MONTH_END_RUN", "Run month-end billing"], ["INVOICE_EDIT", "Edit draft invoice lines"],
    ["INVOICE_DISCOUNT", "Apply discounts"], ["INVOICE_APPROVE", "Approve invoices"], ["INVOICE_SEND", "Send invoices"],
    ["INVOICE_MARK_PAID", "Mark invoices paid"], ["XERO_EXPORT", "Xero export & sync"],
  ]],
  ["Fields", "FIELD", [["FIELD_HIRE_RATES", "See hire rates & prices"], ["FIELD_CUSTOMER_CREDIT", "See customer credit details"]]],
];

const email = (
  id: string,
  group: EmailTemplateRecord["group"],
  name: string,
  trigger: string,
  o: Partial<EmailTemplateRecord>,
): EmailTemplateRecord => ({
  id,
  group,
  name,
  trigger,
  enabled: true,
  mode: "auto",
  modeSelectable: false,
  timing: null,
  recipients: ["customer"],
  attachment: "",
  allowedRecipients: ["customer", "accounts", "rep", "orgAdmin", "orgAccounts"],
  adminCanTurnOff: true,
  subject: "",
  body: "",
  ...o,
});

const EMAIL_TEMPLATES: EmailTemplateRecord[] = [
  email("quote_sent", "sales", "Quotation", "When staff click Send on a quote", {
    mode: "manual", attachment: "Quote PDF", adminCanTurnOff: false,
    subject: "{company_name} Quotation {order_number}",
    body: "Hi {contact_name},\n\nPlease find our quotation for hire {hire_start} → {hire_end}.\n\nValid until {quote_valid_until}. All prices are subject to +10% GST and availability of equipment at time of order.\n\nAny questions, call our {org_name} yard on {org_phone}.",
  }),
  email("quote_expiring", "sales", "Quote expiry reminder", "Before the quote's valid-until date", {
    timing: { days: 3, label: "before the quote expires" }, recipients: ["customer", "rep"],
    subject: "Your quotation {order_number} expires {quote_valid_until}",
    body: "Hi {contact_name},\n\nA reminder that quotation {order_number} is valid until {quote_valid_until}. Reply to this email or call {org_phone} to lock in the equipment.\n\nStock is not held after the quote expires.",
  }),
  email("hire_confirmed", "sales", "Hire confirmation + Conditions of Hire", "When an order is confirmed", {
    attachment: "Hire agreement PDF", adminCanTurnOff: false,
    subject: "{company_name} — Order confirmation {order_number}",
    body: "Hi {contact_name},\n\nYour hire {order_number} is confirmed.\nJobsite: {jobsite}\nPO: {customer_po}\nHire: {hire_start} → {hire_end}\n\nConditions of Hire apply. Invoices are issued at the end of each calendar month for hire in that month.",
  }),
  email("dispatched", "logistics", "Gear on its way", "When the order is dispatched from the yard", {
    enabled: false,
    subject: "{order_number} has left our {org_name} yard",
    body: "Hi {contact_name},\n\nYour equipment for {order_number} has been dispatched to {jobsite}. Hire charges start from today.\n\nOur driver will ask for a signature on delivery.",
  }),
  email("delivered", "logistics", "Proof of delivery", "When the driver completes delivery with a signature", {
    attachment: "Signed delivery docket",
    subject: "Delivered: {order_number}",
    body: "Hi {contact_name},\n\nYour equipment for {order_number} was delivered to {jobsite}. The signed delivery docket is attached.",
  }),
  email("hire_ending", "logistics", "Hire ending soon", "Before the hire end date", {
    timing: { days: 2, label: "before the hire end date" }, recipients: ["customer", "rep"],
    subject: "Your hire {order_number} ends {hire_end}",
    body: "Hi {contact_name},\n\nYour hire {order_number} is due to end on {hire_end}.\n\nNeed it longer? Reply to extend. Otherwise let us know when the gear is ready for pickup.",
  }),
  email("offhire", "logistics", "Off-hire confirmed", "When off-hire is logged", {
    subject: "Off-hire confirmed: {order_number}",
    body: "Hi {contact_name},\n\nWe've logged off-hire for {order_number} on {offhire_date}. Hire charges stop from this date.\n\nOur driver will contact you to arrange pickup.",
  }),
  email("return_receipt", "logistics", "Return receipt", "When return checks are finished", {
    attachment: "Return receipt PDF",
    subject: "Return receipt for {order_number}",
    body: "Hi {contact_name},\n\nYour equipment for {order_number} has been returned and checked. The return receipt is attached.\n\nAny cleaning, damage or missing-item charges will appear on your final invoice.",
  }),
  email("invoice_sent", "finance", "Tax invoice", "When an invoice is approved", {
    mode: "manual", modeSelectable: true, recipients: ["accounts"], attachment: "Tax invoice PDF", adminCanTurnOff: false,
    subject: "{company_name} Tax Invoice {invoice_number}",
    body: "Hi {contact_name},\n\nTax Invoice {invoice_number} for contract {order_number} is attached.\nAmount due: {amount_due} (inc GST) by {due_date}.\n\nRemit to {accounts_email}\nBSB {bsb} · A/C {account}",
  }),
  email("invoice_overdue", "finance", "Overdue invoice reminder", "After the invoice due date", {
    timing: { days: 7, label: "after the due date" }, recipients: ["accounts", "orgAccounts"], attachment: "Tax invoice PDF",
    subject: "Overdue: Tax Invoice {invoice_number}",
    body: "Hi {contact_name},\n\nOur records show Tax Invoice {invoice_number} for {amount_due} was due on {due_date} and is still unpaid.\n\nIf you've already paid, thank you, and please send the remittance to {accounts_email}.",
  }),
  email("payment_received", "finance", "Payment receipt", "When an invoice is marked paid", {
    enabled: false, recipients: ["accounts"],
    subject: "Payment received: {invoice_number}",
    body: "Hi {contact_name},\n\nThanks, we've received payment for Tax Invoice {invoice_number}.",
  }),
  email("cert_expiring", "compliance", "Certificates expiring", "Weekly summary of lifting gear whose test certificate is about to expire", {
    adminCanTurnOff: false, timing: { days: 14, label: "before certificate expiry" },
    recipients: ["orgAdmin"], allowedRecipients: ["orgAdmin"],
    subject: "{org_name}: {cert_count} certificates expiring soon",
    body: "Hi,\n\n{cert_count} serials at {org_name} have test certificates expiring in the next 14 days. Gear with an expired certificate can't be dispatched.\n\nOpen Catalog → Certificates to renew them.",
  }),
];

const org = (
  id: string, code: string, name: string, state: Organization["state"], address: string, phone: string,
  emailAddress: string, active: boolean, createdAt: string, admin: Organization["admin"],
): Organization => ({ id, code, name, state, address, phone, email: emailAddress, active, createdAt, admin });

export function createSeed(): MockDatabase {
  return {
    organizations: [
      org("o_ken", "KEN", "Kenwick", "WA", "135 Logistics Boulevard, Kenwick WA 6107", "+61 8 9358 4099", "perth@riggingrentals.com.au", true, "2026-08-11",
        { name: "Daniel Hayes", email: "daniel.hayes@riggingrentals.com.au", phone: "0412 555 019" }),
      org("o_kar", "KAR", "Karratha", "WA", "12 Coolawanyah Road, Karratha WA 6714", "+61 8 9185 0000", "karratha@riggingrentals.com.au", true, "2026-09-02",
        { name: "Mark Sullivan", email: "mark.sullivan@riggingrentals.com.au", phone: "0438 221 640" }),
      org("o_pnk", "PNK", "Pinkenba", "QLD", "40 Eagle Farm Road, Pinkenba QLD 4008", "+61 7 3260 0000", "brisbane@riggingrentals.com.au", true, "2026-10-14",
        { name: "Chloe Bennett", email: "chloe.bennett@riggingrentals.com.au", phone: "0401 987 332" }),
      org("o_phe", "PHE", "Port Hedland", "WA", "2 Wilson Street, Port Hedland WA 6721", "+61 8 9173 0000", "porthedland@riggingrentals.com.au", true, "2026-11-20",
        { name: "Aaron Walsh", email: "aaron.walsh@riggingrentals.com.au", phone: "0419 640 275" }),
      org("o_dar", "DAR", "Darwin", "NT", "7 Export Drive, East Arm NT 0822", "", "", false, "2026-11-01",
        { name: "Priya Nair", email: "priya.nair@riggingrentals.com.au", phone: "" }),
    ],
    privileges: PRIVILEGE_SEED.flatMap(([area, type, items]) =>
      items.map(([code, label]) => ({ code, label, type, area, description: "", active: true, createdAt: "2026-08-11" })),
    ),
    parameterGroups: PARAMETER_GROUPS,
    platformParameters: {
      SHAREPOINT_ENABLED: true,
      SHAREPOINT_TENANT_ID: "3f9c2a71-5d0e-4b8a-9c11-7e2d40a6b913",
      SHAREPOINT_CLIENT_ID: "b7e14c02-9a3f-4f6d-8e25-1c90d7a4e3f8",
      SHAREPOINT_CLIENT_SECRET: "spsecret-demo-Q7x2",
      SHAREPOINT_SITE_URL: "https://riggingrentals.sharepoint.com/sites/Operations",
      SHAREPOINT_LIBRARY: "Documents",
      SHAREPOINT_FOLDER_PATTERN: "/{org_code}/{year}/{order_number}",
      AI_ENABLED: true,
      AI_PROVIDER: "Anthropic",
      AI_MODEL: "claude-sonnet-5-5",
      AI_API_KEY: "sk-ant-demo-8f2c",
      AI_MAX_TOKENS: 4096,
      AI_MONTHLY_LIMIT: 5000,
      EMAIL_ENABLED: true,
      EMAIL_PROVIDER: "Resend",
      EMAIL_API_KEY: "re_demo_51ab",
      EMAIL_FROM_NAME: "Rigging Rentals",
      EMAIL_FROM_ADDRESS: "noreply@riggingrentals.com.au",
      EMAIL_REPLY_TO: "",
      EMAIL_DAILY_LIMIT: 2000,
    },
    organizationParameters: {
      o_ken: { SHAREPOINT_SITE_URL: "https://riggingrentals.sharepoint.com/sites/Kenwick", EMAIL_REPLY_TO: "perth@riggingrentals.com.au" },
      o_kar: { AI_MONTHLY_LIMIT: 1500, EMAIL_REPLY_TO: "karratha@riggingrentals.com.au" },
      o_pnk: { SHAREPOINT_SITE_URL: "", EMAIL_FROM_NAME: "Rigging Rentals Brisbane", EMAIL_REPLY_TO: "brisbane@riggingrentals.com.au" },
      o_dar: { AI_ENABLED: false },
    },
    emailTemplates: EMAIL_TEMPLATES,
    organizationEmails: {
      o_kar: { hire_ending: { days: 3 } },
      o_pnk: { quote_sent: { subject: "Rigging Rentals Brisbane quotation {order_number}" }, dispatched: { enabled: true } },
    },
    profile: {
      name: "Super Admin",
      email: "superadmin@riggingrentals.com.au",
      mobile: "",
      password: "SuperAdmin1!",
      mfaEnabled: false,
      pendingMfaSecret: null,
    },
  };
}
