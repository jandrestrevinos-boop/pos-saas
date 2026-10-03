import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { billingService, checkoutSchema } from "@/modules/billing/service";

/**
 * POST /api/billing/checkout — el administrador de la empresa genera su
 * link de pago (suscripción mensual en Mercado Pago de Jose).
 * Es el único endpoint de empresa que SIGUE funcionando con el demo vencido.
 */
export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (ctx.isSuperAdmin || !ctx.companyId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    return NextResponse.json({ error: "Solo el administrador puede contratar o pagar el plan" }, { status: 403 });
  }

  const parsed = checkoutSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await billingService.createCheckout(requireCompanyId(ctx), ctx.userId, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo generar el link de pago";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
