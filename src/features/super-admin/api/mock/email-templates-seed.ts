import type { EmailTemplate } from "@/features/super-admin/types";

/**
 * Sample notification emails for the mock Notifications API, used until the
 * backend has a Notifications domain. Shapes match what the backend should
 * return, so this doubles as an example payload for the backend team.
 */

export type EmailTemplateRecord = Omit<EmailTemplate, "custom">;

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

export const EMAIL_TEMPLATES_SEED: EmailTemplateRecord[] = [
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
