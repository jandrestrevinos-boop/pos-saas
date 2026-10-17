import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, type TenantContext } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";

/**
 * Candado común de las rutas de catálogo con feature de plan (costeo por receta, menús completos):
 * quien administra productos Y la empresa tiene la feature en su plan. Devuelve la respuesta de
 * error lista para regresar, o el contexto si todo está bien.
 */
export async function requireCatalogManage(
  featureKey: string,
  featureLabel: string
): Promise<{ ok: true; ctx: TenantContext; companyId: string } | { ok: false; response: NextResponse }> {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.PRODUCTS_MANAGE)) {
    return { ok: false, response: NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 }) };
  }
  if (!(await hasFeature(companyId, featureKey))) {
    return { ok: false, response: NextResponse.json({ error: `Tu plan no incluye ${featureLabel}` }, { status: 403 }) };
  }
  return { ok: true, ctx, companyId };
}

export function errorResponse(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}
