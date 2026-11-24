/**
 * Manual QA checklist for the hire lifecycle (Lead → Paid).
 * Auto smoke:
 *   SELECT public.qa_e2e_hire_lifecycle();
 *   SELECT public.qa_e2e_ops_actions();  -- maintenance Start/Complete + delivery ePOD
 *
 * Roles: sales / workshop / finance / super_admin
 *
 * Note: demo seed UUIDs (e.g. cc000000-0000-…) are valid Postgres uuids but fail
 * Zod `.uuid()` (RFC version bits). App schemas use `.guid()` for id fields.
 */

export const MANUAL_QA_CHECKLIST = [
  {
    id: "1-lead",
    role: "sales",
    title: "Log enquiry (or paste email) on /admin/leads",
    expect: "Lead appears on Enquiries; Orders shows Enquiries (N)",
  },
  {
    id: "2-quote",
    role: "sales",
    title: "Convert → New quote (or Enquiries / New quote on Orders)",
    expect: "Draft order appears in Quotes column; searchable by company",
  },
  {
    id: "3-accept",
    role: "sales",
    title: "Open order → Record hire T&Cs acceptance",
    expect: "Green accepted banner; Confirm blocked until this is done",
  },
  {
    id: "4-confirm",
    role: "sales",
    title: "Confirm quote (PO + acceptance + credit OK)",
    expect: "Stock reserved; card moves to In workshop; delivery task created",
  },
  {
    id: "5-credit-block",
    role: "sales",
    title: "Put client On stop → try confirm another draft",
    expect: "Clear CREDIT_HOLD error; lift stop to proceed",
  },
  {
    id: "6-dispatch",
    role: "workshop",
    title: "Pack + Dispatch with cert check",
    expect: "Assets on_hire; expired cert blocks non-admin",
  },
  {
    id: "7-epod",
    role: "sales/workshop",
    title: "Logistics → En route → Complete with signature",
    expect: "POD signer required; completed shows signed-by",
  },
  {
    id: "8-offhire",
    role: "sales",
    title: "Request off-rent",
    expect: "Status off_rent_pending; pickup task auto-created",
  },
  {
    id: "9-return",
    role: "workshop",
    title: "Return QC (dirty/damage/missing + fees)",
    expect: "Fees queued; repair WO if damaged/missing; draft invoice for Finance",
  },
  {
    id: "10-invoice",
    role: "finance",
    title: "Billing → approve → send → mark paid → Xero CSV / mark synced",
    expect: "Order invoiced on final approve; AR + accounting flags update",
  },
  {
    id: "11-followups",
    role: "ops",
    title: "Ops desk “Action required”",
    expect: "Shows certs, stops, overdue AR, ending hires, expiring quotes",
  },
  {
    id: "12-maintenance",
    role: "ops/workshop",
    title: "Maintenance → Start → Complete on an open WO",
    expect: "Status moves in_progress then completed; asset returns available",
  },
] as const;
