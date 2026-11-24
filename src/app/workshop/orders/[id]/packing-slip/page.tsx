import { redirect } from "next/navigation";

/** Bookmarks to packing-slip land on picking-slip. */
export default async function PackingSlipRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/workshop/orders/${id}/picking-slip`);
}
