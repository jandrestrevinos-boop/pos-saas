import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.INVENTORY_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Inventario</h1>
      <p className="text-muted text-sm mb-8">Existencias y movimientos de los productos que controlas.</p>
      <InventoryClient />
    </div>
  );
}
