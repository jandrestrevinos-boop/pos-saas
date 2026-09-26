import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { kitchenService } from "@/modules/kitchen/service";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  const enabled = await kitchenService.isEnabledForCompany(companyId);
  if (!enabled) {
    return NextResponse.json({ error: "Tu plan actual no incluye la Pantalla de Cocina" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) return NextResponse.json({ error: "Sin sucursales configuradas" }, { status: 400 });

  // "tickets": una ronda de una orden, no la orden completa — ver kitchenService.listActive
  const tickets = await kitchenService.listActive(branchId);
  return NextResponse.json({ tickets });
}
