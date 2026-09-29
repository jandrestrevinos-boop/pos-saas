import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { salesService } from "@/modules/sales/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.SALES_CREATE)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) return NextResponse.json({ error: "Sin sucursales configuradas" }, { status: 400 });

  const orders = await salesService.listPendingWhatsAppOrders(companyId, branchId);
  return NextResponse.json({ orders });
}
