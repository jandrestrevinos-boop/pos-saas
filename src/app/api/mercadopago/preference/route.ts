import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { mercadoPagoService } from "@/modules/mercadoPago/service";

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.PAGOS_INTEGRADOS))) {
    return NextResponse.json({ error: "Tu plan no incluye Pagos integrados" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.SALES_CREATE)) {
    return NextResponse.json({ error: "No tienes permiso para cobrar" }, { status: 403 });
  }

  const body = await req.json();
  const orderId = body?.orderId as string | undefined;
  if (!orderId) {
    return NextResponse.json({ error: "Falta el orderId" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: { items: { include: { product: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  try {
    const preference = await mercadoPagoService.createPreferenceForOrder(companyId, order);
    return NextResponse.json(preference);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo generar el cobro";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
