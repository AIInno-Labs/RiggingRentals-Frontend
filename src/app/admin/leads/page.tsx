import { LeadBoard, LeadIntakeForm } from "@/features/leads/components/lead-board";
import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { isNoiseClient } from "@/features/catalog/is-noise-client";

export default async function LeadsPage() {
  const db = await rentalDb();
  const [{ data }, { data: clients }, { data: orderRows }, { data: catalog }] =
    await Promise.all([
    db
      .from("leads")
      .select("*")
      .neq("status", "lost")
      .neq("status", "won")
      .order("created_at", { ascending: false }),
    db
      .from("clients")
      .select("id, company_name, contact_name, email, phone")
      .order("company_name"),
    db.from("orders").select("client_id"),
    db
      .from("equipment_catalog")
      .select("sku, name, description")
      .eq("is_active", true),
  ]);

  const orderCount = new Map<string, number>();
  for (const row of orderRows ?? []) {
    const id = (row as { client_id: string | null }).client_id;
    if (!id) continue;
    orderCount.set(id, (orderCount.get(id) ?? 0) + 1);
  }

  const clientMatches = (clients ?? []).map((c) => {
    const row = c as {
      id: string;
      company_name: string;
      contact_name: string;
      email: string;
      phone: string;
    };
    return {
      id: row.id,
      company_name: row.company_name ?? "",
      contact_name: row.contact_name ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      order_count: orderCount.get(row.id) ?? 0,
    };
  }).filter((c) => !isNoiseClient(c));

  const leads = (data ?? []).map((row) => {
    const r = row as {
      id: string;
      source: string;
      company_name: string;
      contact_name: string;
      email: string;
      phone: string;
      notes: string;
      estimate_notes: string;
      estimated_value: number;
      status: string;
      client_id: string | null;
    };
    return {
      ...r,
      estimated_value: asNumber(r.estimated_value),
    };
  }).filter((l) => !isNoiseClient(l));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Enquiries</h2>
        <p className="text-sm text-muted-foreground">
          Log a phone or email enquiry, then convert → New quote when they are ready.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <div className="flex min-h-[28rem] flex-col lg:max-h-[70vh] lg:overflow-y-auto">
          <LeadIntakeForm
            clients={clientMatches}
            catalog={(catalog ?? []).map((row) => {
              const r = row as { sku: string; name: string; description?: string };
              return {
                sku: r.sku ?? "",
                name: r.name ?? "",
                description: r.description ?? "",
              };
            })}
          />
        </div>
        <div className="flex min-h-[28rem] flex-col lg:max-h-[70vh] lg:overflow-y-auto">
          <LeadBoard leads={leads} />
        </div>
      </div>
    </div>
  );
}
