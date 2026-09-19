import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";

/** Usado por el POS para hacer polling manual del estatus de un cobro de Mercado Pago pendiente. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  const order = await prisma.order.findFirst({
    where: { id: params.id, companyId },
    include: { payments: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
