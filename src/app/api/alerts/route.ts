import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { alertsService } from "@/modules/alerts/service";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);
  return NextResponse.json(await alertsService.getAlerts(companyId));
}
