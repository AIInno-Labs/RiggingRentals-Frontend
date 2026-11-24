import Link from "next/link";
import { rentalDb } from "@/lib/supabase/rental-db";
import { FollowUpsPanel } from "@/features/dashboard/components/follow-ups-panel";
import { getFollowUps } from "@/features/dashboard/get-follow-ups";
import { isNoiseClient } from "@/features/catalog/is-noise-client";

export async function SalesDeskHome() {
  const db = await rentalDb();
  const [
    { count: draftCount },
    { count: confirmedCount },
    { count: onRentCount },
    followUps,
    { data: openLeads },
  ] = await Promise.all([
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["confirmed", "pre_pick"]),
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "dispatched"),
    getFollowUps(),
    db
      .from("leads")
      .select("id, company_name, contact_name, status")
      .neq("status", "lost")
      .neq("status", "won")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const salesFollowUps = followUps.filter((f) =>
    ["quote_expiring", "account_stop", "off_hire"].includes(f.kind),
  );

  const convertItems = (openLeads ?? [])
    .filter(
      (row) =>
        !isNoiseClient(
          row as { company_name: string; contact_name?: string },
        ),
    )
    .map((row) => {
      const l = row as {
        id: string;
        company_name: string;
        contact_name: string;
        status: string;
      };
      return {
        id: `lead-${l.id}`,
        kind: "lead" as const,
        title: `Convert ${l.company_name}`,
        detail: `${l.status}${l.contact_name ? ` · ${l.contact_name}` : ""} — open inquiry`,
        href: "/admin/leads",
        urgency: "now" as const,
      };
    });

  const queue = [...convertItems, ...salesFollowUps].slice(0, 12);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Today
          </h2>
          <p className="text-sm text-muted-foreground">
            One next action each. Use Enquiries or New quote on Orders.
          </p>
        </div>
        <Link href="/admin/leads" className="text-sm font-medium brand-link">
          Log enquiry
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Open quotes"
          value={String(draftCount ?? 0)}
          href="/admin/pipeline?status=draft"
        />
        <Stat
          label="With workshop"
          value={String(confirmedCount ?? 0)}
          href="/admin/pipeline?status=confirmed"
        />
        <Stat
          label="On rent"
          value={String(onRentCount ?? 0)}
          href="/admin/pipeline?status=dispatched"
        />
      </section>

      <FollowUpsPanel items={queue} />
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      prefetch
      className="steel-panel block rounded-2xl px-4 py-3 transition-colors hover:bg-black/[0.02]"
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-display mt-1 text-3xl font-semibold tabular-nums">
        {value}
      </p>
    </Link>
  );
}
