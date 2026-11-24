import { rentalDb, asNumber } from "@/lib/supabase/rental-db";

export type FollowUpItem = {
  id: string;
  kind: "cert" | "off_hire" | "overdue_invoice" | "quote_expiring" | "account_stop" | "lead" | "delivery";
  title: string;
  detail: string;
  href: string;
  urgency: "now" | "soon";
};

/** Plain-language checklist of what needs a human today. */
export async function getFollowUps(): Promise<FollowUpItem[]> {
  const db = await rentalDb();
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const items: FollowUpItem[] = [];

  const { data: stopped } = await db
    .from("clients")
    .select("id, company_name, on_stop_reason")
    .eq("on_stop", true)
    .limit(8);
  for (const row of stopped ?? []) {
    const c = row as { id: string; company_name: string; on_stop_reason: string };
    items.push({
      id: `stop-${c.id}`,
      kind: "account_stop",
      title: `${c.company_name} — clear credit stop`,
      detail: c.on_stop_reason || "Cannot confirm or dispatch until cleared",
      href: `/admin/clients/${c.id}`,
      urgency: "now",
    });
  }

  const { data: certs } = await db
    .from("equipment_assets")
    .select("id, serial_number, certificate_expires_at")
    .not("certificate_expires_at", "is", null)
    .lte("certificate_expires_at", in7)
    .order("certificate_expires_at")
    .limit(10);
  for (const row of certs ?? []) {
    const a = row as {
      id: string;
      serial_number: string;
      certificate_expires_at: string;
    };
    const expired = a.certificate_expires_at < today;
    items.push({
      id: `cert-${a.id}`,
      kind: "cert",
      title: expired
        ? `Renew cert — RRP ${a.serial_number}`
        : `Cert due soon — RRP ${a.serial_number}`,
      detail: `Expires ${a.certificate_expires_at}`,
      href: "/admin/catalog?cert=expired",
      urgency: expired ? "now" : "soon",
    });
  }

  const { data: offHire } = await db
    .from("orders")
    .select("id, order_number, end_at, status, clients(company_name)")
    .in("status", ["dispatched", "off_rent_pending"])
    .lte("end_at", in7)
    .order("end_at")
    .limit(10);
  for (const row of offHire ?? []) {
    const o = row as {
      id: string;
      order_number: string;
      end_at: string;
      status: string;
      clients:
        | { company_name: string }
        | { company_name: string }[]
        | null;
    };
    const client = Array.isArray(o.clients) ? o.clients[0] : o.clients;
    const due = o.end_at.slice(0, 10);
    items.push({
      id: `oh-${o.id}`,
      kind: "off_hire",
      title:
        o.status === "off_rent_pending"
          ? `Call pickup — ${o.order_number}`
          : `Hire ending — ${o.order_number}`,
      detail: `${client?.company_name ?? "Client"} · end ${due}`,
      href: `/admin/orders/${o.id}`,
      urgency: due <= today || o.status === "off_rent_pending" ? "now" : "soon",
    });
  }

  const { data: overdue } = await db
    .from("invoices")
    .select(
      "id, invoice_number, total, payment_due_at, orders(order_number, clients(company_name))",
    )
    .eq("status", "approved")
    .is("paid_at", null)
    .lt("payment_due_at", today)
    .order("payment_due_at")
    .limit(10);
  for (const row of overdue ?? []) {
    const inv = row as {
      id: string;
      invoice_number: string;
      total: number;
      payment_due_at: string;
      orders:
        | {
            order_number: string;
            clients: { company_name: string } | { company_name: string }[] | null;
          }
        | {
            order_number: string;
            clients: { company_name: string } | { company_name: string }[] | null;
          }[]
        | null;
    };
    const order = Array.isArray(inv.orders) ? inv.orders[0] : inv.orders;
    const client = order
      ? Array.isArray(order.clients)
        ? order.clients[0]
        : order.clients
      : null;
    items.push({
      id: `ar-${inv.id}`,
      kind: "overdue_invoice",
      title: `Collect overdue ${inv.invoice_number}`,
      detail: `${client?.company_name ?? "Account"} · $${asNumber(inv.total).toFixed(0)} due ${inv.payment_due_at}`,
      href: "/billing?status=approved",
      urgency: "now",
    });
  }

  const { data: quotes } = await db
    .from("orders")
    .select("id, order_number, quote_valid_until, clients(company_name)")
    .eq("status", "draft")
    .not("quote_valid_until", "is", null)
    .lte("quote_valid_until", in7)
    .order("quote_valid_until")
    .limit(8);
  for (const row of quotes ?? []) {
    const o = row as {
      id: string;
      order_number: string;
      quote_valid_until: string;
      clients: { company_name: string } | { company_name: string }[] | null;
    };
    const client = Array.isArray(o.clients) ? o.clients[0] : o.clients;
    items.push({
      id: `q-${o.id}`,
      kind: "quote_expiring",
      title: `Confirm ${o.order_number}`,
      detail: `${client?.company_name ?? "Client"} · valid until ${o.quote_valid_until}`,
      href: `/admin/orders/${o.id}`,
      urgency: o.quote_valid_until <= today ? "now" : "soon",
    });
  }

  const { data: deliveries } = await db
    .from("delivery_tasks")
    .select(
      "id, task_type, status, scheduled_at, address, orders(order_number, clients(company_name))",
    )
    .in("status", ["scheduled", "en_route"])
    .order("scheduled_at", { ascending: true })
    .limit(6);
  for (const row of deliveries ?? []) {
    const d = row as {
      id: string;
      task_type: string;
      status: string;
      scheduled_at: string | null;
      address: string | null;
      orders:
        | {
            order_number: string;
            clients: { company_name: string } | { company_name: string }[] | null;
          }
        | {
            order_number: string;
            clients: { company_name: string } | { company_name: string }[] | null;
          }[]
        | null;
    };
    const order = Array.isArray(d.orders) ? d.orders[0] : d.orders;
    const client = order
      ? Array.isArray(order.clients)
        ? order.clients[0]
        : order.clients
      : null;
    const when = d.scheduled_at ? d.scheduled_at.slice(0, 10) : "unscheduled";
    items.push({
      id: `del-${d.id}`,
      kind: "delivery",
      title:
        d.task_type === "pickup"
          ? `Run pickup — ${order?.order_number ?? "hire"}`
          : `Run delivery — ${order?.order_number ?? "hire"}`,
      detail: `${client?.company_name ?? "Client"} · ${d.status} · ${when}${
        d.address ? ` · ${d.address}` : ""
      }`,
      href: "/admin/logistics",
      urgency: d.status === "en_route" ? "now" : "soon",
    });
  }

  const rank = { now: 0, soon: 1 };
  return items.sort((a, b) => rank[a.urgency] - rank[b.urgency]).slice(0, 16);
}
