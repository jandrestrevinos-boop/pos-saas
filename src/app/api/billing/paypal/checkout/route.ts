import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { paypalBilling } from "@/modules/billing/paypal";

/**
 * POST /api/billing/paypal/checkout — el administrador de la empresa genera su
 * suscripción mensual en PayPal (cuenta PayPal Business de Tappy).
 * Igual que el checkout de Mercado Pago, sigue funcionando con el demo vencido.
 */
export async function POST() {
  const ctx = await getTenantContext();
  if (ctx.isSuperAdmin || !ctx.companyId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    return NextResponse.json({ error: "Solo el administrador puede contratar o pagar el plan" }, { status: 403 });
  }

  try {
    const result = await paypalBilling.createCheckout(requireCompanyId(ctx), ctx.userId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Error creando suscripción de PayPal:", err);
    const message = err instanceof Error ? err.message : "No se pudo generar el pago con PayPal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
