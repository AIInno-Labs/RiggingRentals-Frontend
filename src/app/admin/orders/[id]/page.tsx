import Link from "next/link";
import { notFound } from "next/navigation";
import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { catalogLabel } from "@/lib/supabase/relations";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PayToConfirmPanel } from "@/features/orders/components/pay-to-confirm-panel";
import { HireAcceptancePanel } from "@/features/orders/components/hire-acceptance-panel";
import { JobFilesPanel } from "@/features/orders/components/job-files-panel";
import { OrderNotesEditor } from "@/features/orders/components/order-notes-editor";
import {
  OrderConfirmCta,
  OrderDocumentsMenu,
} from "@/features/orders/components/order-documents-menu";
import { OrderConfirmSendButton } from "@/features/orders/components/order-confirm-send-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeAu } from "@/lib/format-date";
import { getCurrentProfile } from "@/features/rbac/get-current-profile";
import { certBlocksHire } from "@/features/availability/compute-availability";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "sales";
  const showOpsChrome = role === "super_admin" || role === "workshop";

  const db = await rentalDb();
  const { data: order } = await db
    .from("orders")
    .select("*, clients(company_name, contact_name, email, phone)")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await db
    .from("order_items")
    .select("*, equipment_catalog(sku, name)")
    .eq("order_id", id);

  const itemIds = (items ?? []).map((i) => (i as { id: string }).id);
  const catalogIds = [
    ...new Set(
      (items ?? []).map((i) => (i as { catalog_id: string }).catalog_id),
    ),
  ];

  const [{ data: assignments }, { data: attachments }, { data: deliveries }, { data: assets }] =
    await Promise.all([
      itemIds.length > 0
        ? db
            .from("order_asset_assignments")
            .select(
              "*, equipment_assets(serial_number), order_items!inner(order_id)",
            )
            .in("order_item_id", itemIds)
        : Promise.resolve({ data: [] as unknown[] }),
      db
        .from("order_attachments")
        .select("*")
        .eq("order_id", id)
        .order("created_at"),
      db
        .from("delivery_tasks")
        .select("*")
        .eq("order_id", id)
        .order("scheduled_at"),
      catalogIds.length > 0
        ? db
            .from("equipment_assets")
            .select("id, catalog_id, serial_number, status, certificate_expires_at")
            .in("catalog_id", catalogIds)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

  const o = order as {
    order_number: string;
    status: string;
    start_at: string;
    end_at: string;
    off_rent_at: string | null;
    fuel_surcharge: number;
    security_deposit: number;
    damage_waiver: boolean;
    notes: string;
    quote_notes?: string;
    jobsite_name: string;
    delivery_address: string;
    purchase_order: string;
    payment_required?: boolean;
    payment_status?: string;
    accepted_hire_agreement_at?: string | null;
    hire_accepted_by?: string;
    hire_accepted_method?: string;
    clients:
      | {
          company_name: string;
          contact_name: string;
          email: string;
          phone: string;
        }
      | {
          company_name: string;
          contact_name: string;
          email: string;
          phone: string;
        }[]
      | null;
  };
  const client = Array.isArray(o.clients) ? o.clients[0] ?? null : o.clients;
  const hireStart = new Date(o.start_at);
  const hireStartDay = o.start_at.slice(0, 10);

  const proofs = (attachments ?? [])
    .filter((a) => (a as { kind: string }).kind === "acceptance")
    .map((a) => {
      const row = a as {
        id: string;
        storage_path: string;
        created_at: string;
      };
      return {
        id: row.id,
        storage_path: row.storage_path,
        created_at: row.created_at,
      };
    });

  const certRows = (items ?? []).map((item) => {
    const row = item as {
      catalog_id: string;
      quantity: number;
      equipment_catalog:
        | { sku: string; name: string }
        | { sku: string; name: string }[]
        | null;
    };
    const forCat = (assets ?? []).filter(
      (a) => (a as { catalog_id: string }).catalog_id === row.catalog_id,
    );
    const valid = forCat.filter((a) => {
      const asset = a as {
        status: string;
        certificate_expires_at: string | null;
      };
      if (["maintenance", "in_inspection", "retired"].includes(asset.status)) {
        return false;
      }
      return !certBlocksHire(asset.certificate_expires_at, hireStart);
    }).length;
    return {
      label: catalogLabel(row.equipment_catalog),
      qty: row.quantity,
      physical: forCat.length,
      valid,
    };
  });

  const assignmentCount = (assignments ?? []).length;
  const anyReturned = (assignments ?? []).some(
    (a) => !!(a as { returned_at: string | null }).returned_at,
  );
  const showReturnReceipt =
    anyReturned ||
    ["off_rent_pending", "returned", "invoiced"].includes(o.status);
  const showSerials =
    assignmentCount > 0 || (o.status !== "draft" && showOpsChrome);
  const showLogistics =
    (deliveries ?? []).length > 0 || (showOpsChrome && o.status !== "draft");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{o.order_number}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{o.status}</Badge>
            <OrderDocumentsMenu
              orderId={id}
              showPackingSlip={showOpsChrome}
              showReturnReceipt={showReturnReceipt}
            />
            {o.status === "draft" ? (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/orders/${id}/edit`}>Edit draft</Link>
                </Button>
                <OrderConfirmCta
                  orderId={id}
                  orderNumber={o.order_number}
                  acceptedAt={o.accepted_hire_agreement_at ?? null}
                  acceptedBy={o.hire_accepted_by ?? ""}
                />
              </>
            ) : null}
            {o.status !== "draft" ? (
              <OrderConfirmSendButton orderId={id} />
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <PayToConfirmPanel
            orderId={id}
            paymentRequired={!!o.payment_required}
            paymentStatus={o.payment_status ?? "not_required"}
          />
          <HireAcceptancePanel
            orderId={id}
            acceptedAt={o.accepted_hire_agreement_at ?? null}
            acceptedBy={o.hire_accepted_by ?? ""}
            acceptedMethod={o.hire_accepted_method ?? ""}
            status={o.status}
            proofs={proofs}
          />
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Client:</span>{" "}
              {client?.company_name}
            </p>
            <p>
              <span className="text-muted-foreground">Contact:</span>{" "}
              {client?.contact_name} {client?.phone}
            </p>
            <p>
              <span className="text-muted-foreground">Jobsite:</span>{" "}
              {o.jobsite_name || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">PO:</span>{" "}
              {o.purchase_order || "—"}
            </p>
            <p className="md:col-span-2">
              <span className="text-muted-foreground">Delivery:</span>{" "}
              {o.delivery_address || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Window:</span>{" "}
              {formatDateTimeAu(o.start_at)} → {formatDateTimeAu(o.end_at)}
            </p>
            <p>
              <span className="text-muted-foreground">Off-rent:</span>{" "}
              {o.off_rent_at ? formatDateTimeAu(o.off_rent_at) : "—"}
            </p>
            <p>Fuel: ${asNumber(o.fuel_surcharge).toFixed(2)}</p>
            <p>Deposit: ${asNumber(o.security_deposit).toFixed(2)}</p>
            <p>Damage waiver: {o.damage_waiver ? "Yes" : "No"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderNotesEditor
            orderId={id}
            quoteNotes={o.quote_notes ?? ""}
            notes={o.notes ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sub Category</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Daily</TableHead>
                <TableHead>Weekly</TableHead>
                <TableHead>Monthly</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((item) => {
                const row = item as {
                  id: string;
                  quantity: number;
                  daily_rate: number;
                  weekly_rate: number;
                  monthly_rate: number;
                  equipment_catalog:
                    | { sku: string; name: string }
                    | { sku: string; name: string }[]
                    | null;
                };
                return (
                  <TableRow key={row.id}>
                    <TableCell>{catalogLabel(row.equipment_catalog)}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell>{asNumber(row.daily_rate).toFixed(2)}</TableCell>
                    <TableCell>{asNumber(row.weekly_rate).toFixed(2)}</TableCell>
                    <TableCell>
                      {asNumber(row.monthly_rate).toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {certRows.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Cert readiness</CardTitle>
            <Link
              href={`/admin/availability?from=${hireStartDay}&to=${o.end_at.slice(0, 10)}`}
              className="text-xs font-medium brand-link"
            >
              See yard for these dates
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {certRows.map((row) => {
              const ok = row.valid >= row.qty;
              return (
                <div
                  key={row.label}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    ok
                      ? "border-[#2f6f4e]/25 bg-[#2f6f4e]/5"
                      : "border-[#b42318]/30 bg-[#b42318]/5 text-[#8f1d14]"
                  }`}
                >
                  <span className="font-medium">{row.label}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {row.valid} of {row.physical} serials cert-OK for{" "}
                    {formatDateTimeAu(o.start_at).split(",")[0] ?? hireStartDay}
                    {row.qty > 1 ? ` (need ${row.qty})` : ""}
                  </span>
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground">
              Sales can view certs only. Ask an administrator to renew expired
              certificates in Catalog.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {showSerials ? (
        <Card>
          <CardHeader>
            <CardTitle>Assigned serials</CardTitle>
          </CardHeader>
          <CardContent>
            {assignmentCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                No serials assigned yet — workshop locks them on confirm /
                dispatch.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial</TableHead>
                    <TableHead>Dispatch m</TableHead>
                    <TableHead>Return m</TableHead>
                    <TableHead>Overage</TableHead>
                    <TableHead>Damage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(assignments ?? []).map((a) => {
                    const row = a as unknown as {
                      id: string;
                      dispatch_meter: number | null;
                      return_meter: number | null;
                      meter_overage_fee: number;
                      damaged: boolean;
                      damage_fee: number;
                      equipment_assets:
                        | { serial_number: string }
                        | { serial_number: string }[]
                        | null;
                    };
                    const asset = Array.isArray(row.equipment_assets)
                      ? row.equipment_assets[0]
                      : row.equipment_assets;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono">
                          {asset?.serial_number ?? "—"}
                        </TableCell>
                        <TableCell>{row.dispatch_meter ?? "—"}</TableCell>
                        <TableCell>{row.return_meter ?? "—"}</TableCell>
                        <TableCell>
                          ${asNumber(row.meter_overage_fee).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {row.damaged
                            ? `Yes ($${asNumber(row.damage_fee).toFixed(0)})`
                            : "No"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Job files</CardTitle>
        </CardHeader>
        <CardContent>
          <JobFilesPanel
            orderId={id}
            files={(attachments ?? []).map((a) => {
              const row = a as {
                id: string;
                kind: string;
                storage_path: string;
                created_at: string;
              };
              return {
                id: row.id,
                kind: row.kind,
                storage_path: row.storage_path,
                created_at: row.created_at,
              };
            })}
          />
        </CardContent>
      </Card>

      {showLogistics ? (
        <Card>
          <CardHeader>
            <CardTitle>Logistics tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(deliveries ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No delivery tasks yet.
              </p>
            ) : (
              (deliveries ?? []).map((t) => {
                const row = t as {
                  id: string;
                  task_type: string;
                  status: string;
                  scheduled_at: string;
                  address: string;
                  driver_notes: string;
                };
                return (
                  <div
                    key={row.id}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium capitalize">
                        {row.task_type}
                      </span>
                      <Badge variant="secondary">{row.status}</Badge>
                    </div>
                    <p className="text-muted-foreground">{row.address}</p>
                    <p className="text-xs">
                      {formatDateTimeAu(row.scheduled_at)}
                    </p>
                    {row.driver_notes ? (
                      <p className="text-xs">{row.driver_notes}</p>
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
