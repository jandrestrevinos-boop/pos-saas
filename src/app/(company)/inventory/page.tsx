import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { getTenantContext, resolveBranchId } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.INVENTORY_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  const ctx = await getTenantContext();
  const [branches, activeBranchId] = await Promise.all([
    prisma.branch.findMany({
      where: { companyId: session.user.companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    resolveBranchId(ctx, session.user.companyId),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Inventario</h1>
      <p className="text-muted text-sm mb-8">
        {branches.length > 1
          ? "Existencias de la sucursal en la que estás operando. Cambia de sucursal desde el menú."
          : "Existencias y movimientos de los productos que controlas."}
      </p>
      <InventoryClient
        branches={branches}
        activeBranchId={activeBranchId ?? branches[0]?.id ?? ""}
        canTransfer={hasPermission(session.user.permissions, PERMISSIONS.BRANCHES_MANAGE)}
      />
    </div>
  );
}
