import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { mercadoPagoService } from "@/modules/mercadoPago/service";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
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
    await mercadoPagoService.cancelPointOrder(companyId, params.id);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
    await prisma.order.update({ where: { id: payment.orderId }, data: { status: "CANCELED" } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo cancelar. Si ya llegó a la terminal, cancélalo desde ahí.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
