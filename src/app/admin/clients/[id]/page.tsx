import Link from "next/link";
import { notFound } from "next/navigation";
import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { ClientForm } from "@/features/catalog/components/client-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await rentalDb();
  const { data: client } = await db
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!client) notFound();

  const c = client as {
    id: string;
    company_name: string;
    contact_name: string;
    email: string;
    phone: string;
    billing_address: string;
    notes: string;
    credit_account: boolean;
    credit_limit: number;
    payment_terms_days: number;
    on_stop: boolean;
    on_stop_reason: string;
  };

  const { data: orders } = await db
    .from("orders")
    .select(
      "id, order_number, status, start_at, end_at, jobsite_name, purchase_order, security_deposit",
    )
    .eq("client_id", id)
    .order("start_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{c.company_name}</h2>
          {c.on_stop ? (
            <Badge className="bg-[#b42318] text-white hover:bg-[#b42318]">
              On stop
            </Badge>
          ) : null}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/clients">Back</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Edit client</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientForm
            initial={{
              id: c.id,
              company_name: c.company_name,
              contact_name: c.contact_name,
              email: c.email,
              phone: c.phone,
              billing_address: c.billing_address,
              notes: c.notes,
              credit_account: c.credit_account,
              credit_limit: asNumber(c.credit_limit),
              payment_terms_days: c.payment_terms_days ?? 30,
              on_stop: c.on_stop,
              on_stop_reason: c.on_stop_reason ?? "",
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Rental history ({(orders ?? []).length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Jobsite</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Deposit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orders ?? []).map((row) => {
                const o = row as {
                  id: string;
                  order_number: string;
                  status: string;
                  start_at: string;
                  end_at: string;
                  jobsite_name: string;
                  security_deposit: number;
                };
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-medium hover:underline"
                      >
                        {o.order_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{o.status}</Badge>
                    </TableCell>
                    <TableCell>{o.jobsite_name || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(o.start_at).toLocaleDateString("en-AU")} →{" "}
                      {new Date(o.end_at).toLocaleDateString("en-AU")}
                    </TableCell>
                    <TableCell>
                      ${asNumber(o.security_deposit).toFixed(0)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
