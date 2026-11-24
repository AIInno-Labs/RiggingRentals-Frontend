export const COMPANY = {
  legalName: "Rigging Rentals (WA) Pty Ltd",
  tradingAs: "Rigging Rentals",
  website: "https://www.riggingrentals.com.au",
  logoPath: "/logo-rigging-rentals.png",
  abn: "94 105 556 563",
  phone: "1300 774 736",
  officePhone: "+61 8 9358 4099",
  email: "perth@riggingrentals.com.au",
  accountsEmail: "waadmin@riggingrentals.com.au",
  addressLine1: "135 Logistics Boulevard",
  addressLine2: "Kenwick WA 6107",
  bank: {
    name: "WESTPAC MORLEY",
    bsb: "036-062",
    account: "764449",
  },
  gstRate: 0.1,
  quoteValidityDays: 30,
  defaultQuoteNotes: [
    "All prices quoted are subject to +10% GST",
    "This offer is subject to availability of equipment at time of order",
    "Quote valid for 30 days",
    "Ex stock Rigging Rentals Kenwick",
    "Rental equipment to come back clean or there will be a cleaning fee charged when invoiced.",
  ],
} as const;

/** Absolute logo URL for outbound email HTML when NEXT_PUBLIC_APP_URL is set. */
export function companyLogoAbsoluteUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "").trim();
  if (!base) return null;
  return `${base}${COMPANY.logoPath}`;
}

export function formatAud(n: number): string {
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
  });
}

export function formatAuDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
