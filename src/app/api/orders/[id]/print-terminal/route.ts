import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { mercadoPagoService, buildTerminalReceiptContent } from "@/modules/mercadoPago/service";

/**
 * Manda a imprimir el ticket completo (productos, tipo de pedido, dirección,
 * comentarios) en la terminal física vinculada a la sucursal de la orden.
 * No importa con qué se haya pagado (efectivo, tarjeta genérica,
 * transferencia, terminal, link) — esto es solo la impresión, separada
 * del cobro. Pensado para negocios que no tienen impresora térmica y usan
 * la terminal como su único aparato físico para dársela al repartidor.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.PAGOS_INTEGRADOS))) {
    return NextResponse.json({ error: "Tu plan no incluye Pagos integrados" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.SALES_CREATE)) {
    return NextResponse.json({ error: "No tienes permiso para imprimir" }, { status: 403 });
  }

  const order = await prisma.order.findFirst({
    where: { id: params.id, companyId },
    include: { items: { include: { product: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  const terminal = await prisma.mercadoPagoTerminal.findUnique({ where: { branchId: order.branchId } });
  if (!terminal) {
    return NextResponse.json({ error: "Esta sucursal no tiene una terminal vinculada" }, { status: 400 });
  }

  try {
    const content = buildTerminalReceiptContent({
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      notes: order.notes,
      deliveryAddress: order.deliveryAddress,
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      items: order.items,
    });
    const action = await mercadoPagoService.printOnTerminal(companyId, terminal.terminalId, content);
    return NextResponse.json({ action });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo imprimir en la terminal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
