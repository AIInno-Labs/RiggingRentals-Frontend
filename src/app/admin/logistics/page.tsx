import { rentalDb } from "@/lib/supabase/rental-db";
import { LogisticsBoard } from "@/features/operations/components/logistics-board";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LogisticsPage() {
  const db = await rentalDb();
  const { data } = await db
    .from("delivery_tasks")
    .select(
      "id, task_type, status, scheduled_at, address, driver_notes, pod_signed_by, pod_notes, orders(order_number, clients(company_name))",
    )
    .neq("status", "cancelled")
    .order("scheduled_at");

  const rows = (data ?? []).map((row) => {
    const r = row as {
      id: string;
      task_type: string;
      status: string;
      scheduled_at: string;
      address: string;
      driver_notes: string;
      pod_signed_by: string;
      pod_notes: string;
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
    const order = Array.isArray(r.orders) ? r.orders[0] : r.orders;
    const client = order
      ? Array.isArray(order.clients)
        ? order.clients[0]
        : order.clients
      : null;
    return {
      id: r.id,
      task_type: r.task_type,
      status: r.status,
      scheduled_at: r.scheduled_at,
      address: r.address,
      driver_notes: r.driver_notes,
      pod_signed_by: r.pod_signed_by,
      pod_notes: r.pod_notes,
      order_number: order?.order_number ?? "—",
      company_name: client?.company_name ?? "—",
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery & pickup logistics</CardTitle>
        <CardDescription>
          Mark en route, then complete with a site signature (proof of delivery).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LogisticsBoard rows={rows} />
      </CardContent>
    </Card>
  );
}
