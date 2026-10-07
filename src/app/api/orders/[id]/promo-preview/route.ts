import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { tableTabsService } from "@/modules/tableTabs/service";

/** Muestra cuánto descuentan las promociones sobre una cuenta de mesa abierta, antes de cobrar. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.GESTION_MESAS))) {
    return NextResponse.json({ error: "Tu plan no incluye Gestión de mesas" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.SALES_CREATE)) {
    return NextResponse.json({ error: "No tienes permiso para cobrar" }, { status: 403 });
  }

  const coupon = new URL(req.url).searchParams.get("coupon") || undefined;
  try {
    return NextResponse.json(await tableTabsService.promoPreview(companyId, params.id, coupon));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo calcular el descuento" }, { status: 400 });
  }
}
