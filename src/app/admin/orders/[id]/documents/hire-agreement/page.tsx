import { notFound } from "next/navigation";
import Link from "next/link";
import { rentalDb } from "@/lib/supabase/rental-db";
import { PrintShell } from "@/features/documents/print-shell";
import {
  COMPANY,
  formatAuDate,
} from "@/features/documents/company-profile";
import { HIRE_CLAUSES } from "@/features/documents/hire-terms";

export default async function HireAgreementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await rentalDb();
  const { data: order } = await db
    .from("orders")
    .select(
      "*, clients(company_name, contact_name, email, phone, billing_address)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const o = order as {
    order_number: string;
    start_at: string;
    end_at: string;
    purchase_order: string;
    jobsite_name: string;
    delivery_address: string;
    accepted_hire_agreement_at: string | null;
    hire_accepted_by?: string;
    hire_accepted_method?: string;
    clients:
      | {
          company_name: string;
          contact_name: string;
          email: string;
          phone: string;
          billing_address: string;
        }
      | {
          company_name: string;
          contact_name: string;
          email: string;
          phone: string;
          billing_address: string;
        }[]
      | null;
  };
  const client = Array.isArray(o.clients) ? o.clients[0] : o.clients;

  return (
    <div className="min-h-screen bg-[#f5f5f5] py-6">
      <div className="no-print mx-auto mb-4 max-w-[900px] px-6">
        <Link href={`/admin/orders/${id}`} className="text-sm brand-link">
          ← Back to order
        </Link>
      </div>
      <PrintShell title={o.order_number} docLabel="Conditions of Hire Agreement">
        <p className="mb-4 text-xs text-[#5c6570]">
          RigRent QED.10 Rev0 — {COMPANY.legalName} · Accounts:{" "}
          {COMPANY.accountsEmail}
        </p>

        <div className="mb-4 grid gap-2 rounded border border-[#d4d4d8] p-3 text-sm md:grid-cols-2">
          <div>
            <p>
              <strong>Hirer:</strong> {client?.company_name}
            </p>
            <p>
              <strong>Authorized contact:</strong> {client?.contact_name}
            </p>
            <p>{client?.billing_address}</p>
            <p>
              {client?.email} · {client?.phone}
            </p>
          </div>
          <div>
            <p>
              <strong>Contract / order:</strong> {o.order_number}
            </p>
            <p>
              <strong>Client PO / job:</strong> {o.purchase_order || "—"}
            </p>
            <p>
              <strong>Jobsite:</strong> {o.jobsite_name || "—"}
            </p>
            <p>
              <strong>Delivery:</strong> {o.delivery_address || "—"}
            </p>
            <p>
              <strong>Hire window:</strong> {formatAuDate(o.start_at)} →{" "}
              {formatAuDate(o.end_at)}
            </p>
            {o.accepted_hire_agreement_at ? (
              <p>
                <strong>Accepted:</strong>{" "}
                {formatAuDate(o.accepted_hire_agreement_at)}
                {o.hire_accepted_by
                  ? ` by ${o.hire_accepted_by}`
                  : ""}
                {o.hire_accepted_method
                  ? ` (${o.hire_accepted_method.replaceAll("_", " ")})`
                  : ""}
              </p>
            ) : (
              <p>
                <strong>Accepted:</strong> Not yet recorded
              </p>
            )}
          </div>
        </div>

        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide">
          Key conditions (summary)
        </h2>
        <ol className="mb-6 list-decimal space-y-2 pl-5 text-xs leading-relaxed">
          {HIRE_CLAUSES.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>

        <p className="mb-6 text-xs italic">
          “I the hirer or authorized representative have read and understood the
          terms and conditions set out in this hire agreement document issued for
          the one off or ongoing hire of equipment from {COMPANY.legalName}.”
        </p>

        <div className="grid gap-6 text-sm md:grid-cols-2">
          <div className="space-y-4">
            <p>Hirer’s Entity Name: _______________________________</p>
            <p>Signature: _______________________________________</p>
            <p>Printed Name: ____________________________________</p>
          </div>
          <div className="space-y-4">
            <p>Position / Title: _________________________________</p>
            <p>Date: ___________________________________________</p>
            <p>Company witness: ________________________________</p>
          </div>
        </div>
      </PrintShell>
    </div>
  );
}
