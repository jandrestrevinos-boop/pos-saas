import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { tableTabsService, addRoundSchema } from "@/modules/tableTabs/service";

/** Manda una ronda nueva de productos a una cuenta de mesa ya abierta (no cobra, solo manda a cocina). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.GESTION_MESAS))) {
    return NextResponse.json({ error: "Tu plan no incluye Gestión de mesas" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.SALES_CREATE)) {
    return NextResponse.json({ error: "No tienes permiso para agregar productos" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) {
    return NextResponse.json({ error: "La empresa no tiene sucursales configuradas" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = addRoundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const order = await tableTabsService.addRound(companyId, branchId, ctx.userId, params.id, parsed.data);
    return NextResponse.json({ order });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo mandar la ronda a cocina";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
