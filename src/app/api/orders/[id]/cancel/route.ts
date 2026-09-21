import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { salesService } from "@/modules/sales/service";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.SALES_CANCEL)) {
    return NextResponse.json({ error: "No tienes permiso para cancelar ventas" }, { status: 403 });
  }

  try {
    const order = await salesService.cancelSale(companyId, params.id, ctx.userId);
    return NextResponse.json({ order });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo cancelar la venta";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
