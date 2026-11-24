/** Shared Conditions of Hire summary (RigRent QED.10) for PDF + email. */
export const HIRE_CLAUSES = [
  "Hire charges apply from commencement of hire (dispatch) until off-hire / return, regardless of whether equipment is used.",
  "Invoices are issued at the end of each calendar month for hire falling in that month, and a final invoice on return for any remaining days (Conditions of Hire 3(e)).",
  "Equipment remains the property of the Company at all times and is strictly not for sale.",
  "Hirer is responsible for loss, damage, cleaning, and return of transport cases; cleaning fees may apply on invoice.",
  "Payment terms: 30 day nett monthly (30 days from end of month) for approved credit accounts.",
  "Full Conditions of Hire (RigRent QED.10) apply and prevail over any Hirer terms.",
] as const;

export function hireTermsHtmlList(): string {
  return HIRE_CLAUSES.map((c) => `<li>${c}</li>`).join("");
}
