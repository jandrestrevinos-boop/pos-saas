import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { tableTabsService } from "@/modules/tableTabs/service";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.GESTION_MESAS))) {
    return NextResponse.json({ error: "Tu plan no incluye Gestión de mesas" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.TABLES_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para abrir mesas" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) {
    return NextResponse.json({ error: "La empresa no tiene sucursales configuradas" }, { status: 400 });
  }

  try {
    const order = await tableTabsService.open(companyId, branchId, ctx.userId, params.id);
    return NextResponse.json({ order });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo abrir la mesa";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
