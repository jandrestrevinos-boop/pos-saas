import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { tablesService, updateTableSchema } from "@/modules/tables/service";

async function assertAccess(companyId: string, permissions: string[]) {
  if (!(await hasFeature(companyId, FEATURE_KEYS.GESTION_MESAS))) {
    return NextResponse.json({ error: "Tu plan no incluye Gestión de mesas" }, { status: 403 });
  }
  if (!hasPermission(permissions, PERMISSIONS.TABLES_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para editar mesas" }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  const denied = await assertAccess(companyId, ctx.permissions);
  if (denied) return denied;

  const body = await req.json();

  // "advance" es un atajo desde la vista de mesas para avanzar el ciclo
  // Libre → Ocupada → Cuenta → Limpieza → Libre sin mandar el status explícito.
  if (body?.action === "advance") {
    try {
      const table = await tablesService.advanceStatus(companyId, params.id);
      return NextResponse.json({ table });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar la mesa";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const parsed = updateTableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const table = await tablesService.update(companyId, params.id, parsed.data);
    return NextResponse.json({ table });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo actualizar la mesa";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  const denied = await assertAccess(companyId, ctx.permissions);
  if (denied) return denied;

  try {
    await tablesService.remove(companyId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo eliminar la mesa";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
