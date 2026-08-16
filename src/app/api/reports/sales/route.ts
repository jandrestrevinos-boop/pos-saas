import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { reportsService } from "@/modules/reports/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function GET(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.REPORTS_VIEW)) {
    return NextResponse.json({ error: "No tienes permiso para ver reportes" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const from = fromParam ? new Date(fromParam) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = toParam ? new Date(toParam) : new Date();
  to.setHours(23, 59, 59, 999);

  const report = await reportsService.salesReport(companyId, from, to);
  return NextResponse.json(report);
}
