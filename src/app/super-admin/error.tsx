"use client";

import { RouteError } from "@/components/route-error";
import { COPY } from "@/features/super-admin/constants/copy";

export default function SuperAdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} title={COPY.errors.pageTitle} />;
}
