"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function RouteError({
  error,
  reset,
  title = "Something went wrong",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  useEffect(() => {
    console.error("[route]", error);
  }, [error]);

  return (
    <div className="space-y-3 py-6" role="alert">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        This page failed to load. Your data was not changed. Try again.
      </p>
      <Button type="button" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
