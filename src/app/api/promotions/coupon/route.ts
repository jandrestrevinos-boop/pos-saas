import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { promotionsService } from "@/modules/promotions/service";

/** El cajero escribe un cupón: si es válido regresa su regla para mostrar el descuento en el POS. */
export async function GET(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);
  if (!hasPermission(ctx.permissions, PERMISSIONS.SALES_CREATE)) {
    return NextResponse.json({ error: "No tienes permiso" }, { status: 403 });
  }

  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!code.trim()) return NextResponse.json({ error: "Escribe el código del cupón" }, { status: 400 });

  try {
    return NextResponse.json({ promotion: await promotionsService.validateCoupon(companyId, code) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Cupón no válido" }, { status: 400 });
  }
}
