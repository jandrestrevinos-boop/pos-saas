import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { mercadoPagoService } from "@/modules/mercadoPago/service";

/** Manda el cobro de una orden ya creada (Mostrador o cuenta de mesa) a la terminal física vinculada a la sucursal. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.PAGOS_INTEGRADOS))) {
    return NextResponse.json({ error: "Tu plan no incluye Pagos integrados" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.SALES_CREATE)) {
    return NextResponse.json({ error: "No tienes permiso para cobrar" }, { status: 403 });
  }

  const order = await prisma.order.findFirst({ where: { id: params.id, companyId } });
  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  const terminal = await prisma.mercadoPagoTerminal.findUnique({ where: { branchId: order.branchId } });
  if (!terminal) {
    return NextResponse.json({ error: "Esta sucursal no tiene una terminal vinculada" }, { status: 400 });
  }

  try {
    const pointOrder = await mercadoPagoService.createPointOrder(
      companyId,
      order.id,
      Number(order.total),
      terminal.terminalId
    );
    return NextResponse.json({ pointOrder });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo mandar el cobro a la terminal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
