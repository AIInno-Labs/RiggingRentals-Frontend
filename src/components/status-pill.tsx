import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  // leads / generic
  new: "border-[#d4d4d8] bg-[#f4f4f5] text-[#3f3f46]",
  qualified: "border-emerald-600/30 bg-emerald-500/15 text-emerald-900",
  quoted: "border-sky-600/30 bg-sky-500/15 text-sky-900",
  lost: "border-[#d4d4d8] bg-white text-[#52525b]",
  won: "border-emerald-700/40 bg-emerald-600 text-white",
  // work orders
  open: "border-amber-700/50 bg-amber-100 text-amber-950",
  in_progress: "border-sky-700/50 bg-sky-100 text-sky-950",
  waiting_parts: "border-orange-700/50 bg-orange-100 text-orange-950",
  completed: "border-emerald-700/50 bg-emerald-100 text-emerald-950",
  // workshop order
  confirmed: "border-sky-700/50 bg-sky-100 text-sky-950",
  pre_pick: "border-amber-700/50 bg-amber-100 text-amber-950",
  dispatched: "border-emerald-700/50 bg-emerald-100 text-emerald-950",
  off_rent_pending: "border-orange-700/50 bg-orange-100 text-orange-950",
  returned: "border-[#52525b]/40 bg-[#f4f4f5] text-[#27272a]",
  cancelled: "border-[#d4d4d8] bg-white text-[#71717a]",
  // invoices
  draft: "border-amber-700/50 bg-amber-100 text-amber-950",
  approved: "border-sky-700/50 bg-sky-100 text-sky-950",
  final: "border-sky-700/50 bg-sky-100 text-sky-950",
  paid: "border-emerald-700/50 bg-emerald-600 text-white",
  sent: "border-[#111111]/40 bg-[#111111]/10 text-[#111111]",
  synced: "border-emerald-700/40 bg-emerald-100 text-emerald-950",
  reserved: "border-violet-700/40 bg-violet-100 text-violet-950",
  on_hire: "border-sky-700/50 bg-sky-100 text-sky-950",
  available: "border-emerald-700/40 bg-emerald-100 text-emerald-950",
  maintenance: "border-orange-700/50 bg-orange-100 text-orange-950",
  in_inspection: "border-amber-700/50 bg-amber-100 text-amber-950",
};

export function StatusPill({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = status.toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium capitalize",
        TONE[key] ?? "border-[#d4d4d8] bg-white text-[#52525b]",
        className,
      )}
    >
      {key === "pre_pick" ? "ready for dispatch" : status.replaceAll("_", " ")}
    </Badge>
  );
}
