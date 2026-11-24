import { rentalDb } from "@/lib/supabase/rental-db";
import { isNoiseClient } from "@/features/catalog/is-noise-client";
import { ClientsDirectory } from "@/features/catalog/components/clients-directory";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const db = await rentalDb();
  const { data } = await db
    .from("clients")
    .select("*")
    .order("company_name");

  const clients = (data ?? [])
    .filter(
      (row) =>
        !isNoiseClient(
          row as { company_name: string; contact_name?: string; email?: string },
        ),
    )
    .map((c) => {
      const row = c as {
        id: string;
        company_name: string;
        contact_name: string;
        email: string;
        phone: string;
        credit_account: boolean;
        on_stop: boolean;
      };
      return {
        id: row.id,
        company_name: row.company_name,
        contact_name: row.contact_name,
        email: row.email,
        phone: row.phone,
        credit_account: row.credit_account,
        on_stop: row.on_stop,
      };
    });

  return (
    <ClientsDirectory clients={clients} initialQuery={sp.q?.trim() ?? ""} />
  );
}
