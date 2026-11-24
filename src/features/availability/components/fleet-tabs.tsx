import Link from "next/link";
import { cn } from "@/lib/utils";

export function FleetTabs({
  view,
  from,
  to,
}: {
  view: "yard" | "rates";
  from: string;
  to: string;
}) {
  const yard = `/admin/availability?from=${from}&to=${to}`;
  const rates = `${yard}&view=rates`;
  return (
    <div className="flex gap-1 rounded-xl border border-border bg-white p-1">
      <Link
        href={yard}
        prefetch
        className={cn(
          "rounded-lg px-3 py-1.5 text-sm font-medium",
          view === "yard"
            ? "bg-[#111111] text-[#f5d400]"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Yard
      </Link>
      <Link
        href={rates}
        prefetch
        className={cn(
          "rounded-lg px-3 py-1.5 text-sm font-medium",
          view === "rates"
            ? "bg-[#111111] text-[#f5d400]"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Price list
      </Link>
    </div>
  );
}
