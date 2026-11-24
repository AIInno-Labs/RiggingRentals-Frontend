"use client";

import { RouteError } from "@/components/route-error";

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} title="Billing page error" />;
}
