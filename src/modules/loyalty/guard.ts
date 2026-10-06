import { NextResponse } from "next/server";
import { getTenantContext, type TenantContext } from "@/lib/tenant-context";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";

/**
 * Validación común de las rutas de /api/loyalty (staff): sesión, empresa, permiso y que la
 * empresa tenga la feature "clientes_frecuentes" en su plan.
 */
export async function loyaltyGuard(
  permission: PermissionKey
): Promise<{ ctx: TenantContext; companyId: string; error?: undefined } | { error: NextResponse }> {
  let ctx: TenantContext;
  try {
    ctx = await getTenantContext();
  } catch {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  if (!ctx.companyId) {
    return { error: NextResponse.json({ error: "Se requiere una empresa" }, { status: 403 }) };
  }
  if (!hasPermission(ctx.permissions, permission)) {
    return { error: NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 }) };
  }
  if (!(await hasFeature(ctx.companyId, FEATURE_KEYS.CLIENTES_FRECUENTES))) {
    return {
      error: NextResponse.json({ error: "Tu plan no incluye el programa de clientes frecuentes" }, { status: 403 }),
    };
  }
  return { ctx, companyId: ctx.companyId };
}

export function errorResponse(err: unknown, fallback: string) {
  return NextResponse.json({ error: err instanceof Error ? err.message : fallback }, { status: 400 });
}
