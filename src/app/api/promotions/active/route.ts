import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { promotionsService } from "@/modules/promotions/service";

/** Promociones automáticas (sin cupón) que el POS usa para mostrar el descuento antes de cobrar. */
export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);
  if (!hasPermission(ctx.permissions, PERMISSIONS.SALES_CREATE)) {
    return NextResponse.json({ error: "No tienes permiso" }, { status: 403 });
  }
  return NextResponse.json({ promotions: await promotionsService.activeRules(companyId) });
}
