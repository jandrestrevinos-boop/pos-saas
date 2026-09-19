import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { mercadoPagoService } from "@/modules/mercadoPago/service";

const APPROVED_STATUSES = ["processed"];
const FAILED_STATUSES = ["canceled", "expired"];

/**
 * Consulta el estatus de un cobro mandado a una terminal física (polling
 * manual desde el POS, igual que con el link/QR). id = el id de la ORDEN
 * de Point en Mercado Pago (Payment.mpPointOrderId), no el id de la venta.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  const payment = await prisma.payment.findFirst({
    where: { mpPointOrderId: params.id },
    include: { order: true },
  });
  if (!payment || payment.order.companyId !== companyId) {
    return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });
  }

  try {
    const pointOrder = await mercadoPagoService.getPointOrder(companyId, params.id);
    const mpStatus: string = pointOrder.status;

    if (APPROVED_STATUSES.includes(mpStatus) && payment.status === "PENDING") {
      const paymentId = pointOrder.transactions?.payments?.[0]?.id ?? null;
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "APPROVED", mpPaymentId: paymentId ? String(paymentId) : undefined },
      });
      const { salesService } = await import("@/modules/sales/service");
      await salesService.finalizeApprovedOrder(payment.orderId);
    } else if (FAILED_STATUSES.includes(mpStatus) && payment.status === "PENDING") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "REJECTED" } });
      await prisma.order.update({ where: { id: payment.orderId }, data: { status: "CANCELED" } });
    }

    return NextResponse.json({ status: mpStatus, paymentStatus: payment.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo consultar el cobro";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
