import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { reportsService } from "@/modules/reports/service";

export async function GET(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.DASHBOARD_EMPRESARIAL))) {
    return NextResponse.json({ error: "Tu plan no incluye el Dashboard empresarial" }, { status: 403 });
  }
  // Información financiera sensible (costos, márgenes): solo el Admin de la empresa.
  if (ctx.roleName !== "ADMIN_EMPRESA") {
    return NextResponse.json({ error: "No tienes permiso para ver esta información" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") ?? "30");

  const data = await reportsService.enterpriseDashboard(companyId, days);
  return NextResponse.json(data);
}
