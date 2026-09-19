import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { tablesService, createTableSchema } from "@/modules/tables/service";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.GESTION_MESAS))) {
    return NextResponse.json({ error: "Tu plan no incluye Gestión de mesas" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.TABLES_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para ver mesas" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) {
    return NextResponse.json({ error: "La empresa no tiene sucursales configuradas" }, { status: 400 });
  }

  const tables = await tablesService.list(companyId, branchId);
  return NextResponse.json({ tables });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.GESTION_MESAS))) {
    return NextResponse.json({ error: "Tu plan no incluye Gestión de mesas" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.TABLES_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para crear mesas" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) {
    return NextResponse.json({ error: "La empresa no tiene sucursales configuradas" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = createTableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const table = await tablesService.create(companyId, branchId, parsed.data);
    return NextResponse.json({ table }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear la mesa";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
