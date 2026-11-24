import { rentalDb } from "@/lib/supabase/rental-db";

export type WorkshopNavBadges = {
  "/workshop": number;
  "/workshop/repairs": number;
};

/** Open workshop workload for sidebar badges (Jobs + Repairs). */
export async function getWorkshopNavBadges(): Promise<WorkshopNavBadges> {
  const db = await rentalDb();
  const [{ count: jobs }, { count: repairs }] = await Promise.all([
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["confirmed", "pre_pick", "dispatched", "off_rent_pending"]),
    db
      .from("maintenance_work_orders")
      .select("id", { count: "exact", head: true })
      .eq("work_type", "repair")
      .neq("status", "completed")
      .neq("status", "cancelled"),
  ]);

  return {
    "/workshop": jobs ?? 0,
    "/workshop/repairs": repairs ?? 0,
  };
}
