import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { getAuthorizeUrl } from "@/modules/mercadoPago/service";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.PAGOS_INTEGRADOS))) {
    return NextResponse.json({ error: "Tu plan no incluye Pagos integrados" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para conectar Mercado Pago" }, { status: 403 });
  }

  try {
    return NextResponse.redirect(getAuthorizeUrl(companyId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo iniciar la conexión con Mercado Pago";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
