/** QA seeds and email-parse leftovers that should not appear as real accounts. */
export function isNoiseClient(row: {
  company_name: string;
  contact_name?: string | null;
  email?: string | null;
}): boolean {
  const company = row.company_name.trim();
  const contact = (row.contact_name ?? "").trim();
  const email = (row.email ?? "").trim().toLowerCase();
  if (/^zz archive\b/i.test(company)) return true;
  if (/^e2e\b/i.test(company)) return true;
  if (/@lifecycle\.example$/i.test(email) || email === "qa-e2e@example.com") {
    return true;
  }
  if (/qa lifecycle bot/i.test(contact) || /^qa bot$/i.test(contact)) return true;
  if (/\brigging\s+rentals?\b/i.test(company) || /^hi\s+/i.test(company)) {
    return true;
  }
  if (/\(from email\)$/i.test(company)) return true;
  if (/^test$/i.test(company)) return true;
  return false;
}
