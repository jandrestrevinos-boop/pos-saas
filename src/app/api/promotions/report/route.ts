import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { promotionsService, type PromoReportRange } from "@/modules/promotions/service";

export async function GET(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);
  if (!hasPermission(ctx.permissions, PERMISSIONS.PRODUCTS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para ver el reporte de promociones" }, { status: 403 });
  }

  const raw = new URL(req.url).searchParams.get("range");
  const range: PromoReportRange = raw === "7d" || raw === "30d" ? raw : "today";
  return NextResponse.json(await promotionsService.report(companyId, range));
}
