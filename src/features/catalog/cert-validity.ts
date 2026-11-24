export type CertValidity = "valid" | "expiring" | "expired" | "missing";

export function certValidity(
  expiresAt: string | null | undefined,
  today: string,
  soon: string,
): CertValidity {
  if (!expiresAt) return "missing";
  if (expiresAt < today) return "expired";
  if (expiresAt <= soon) return "expiring";
  return "valid";
}

export function certValidityLabel(v: CertValidity): string {
  switch (v) {
    case "expired":
      return "Expired";
    case "expiring":
      return "Expiring";
    case "missing":
      return "No expiry";
    default:
      return "Valid";
  }
}
