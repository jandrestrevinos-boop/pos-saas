import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { tableTabsService, closeTabSchema } from "@/modules/tableTabs/service";

/** Cierra la cuenta de una mesa: cobra el total acumulado de todas las rondas y libera la mesa. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.GESTION_MESAS))) {
    return NextResponse.json({ error: "Tu plan no incluye Gestión de mesas" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.SALES_CREATE)) {
    return NextResponse.json({ error: "No tienes permiso para cobrar" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = closeTabSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const order = await tableTabsService.close(companyId, params.id, parsed.data);
    let mpCheckout: { preferenceId: string; checkoutUrl: string } | null = null;
    let pointOrder: { id: string; status: string } | null = null;

    const { mercadoPagoService } = await import("@/modules/mercadoPago/service");

    if (parsed.data.paymentMethod === "MERCADOPAGO") {
      mpCheckout = await mercadoPagoService.createPreferenceForOrder(companyId, order);
    } else if (parsed.data.paymentMethod === "MERCADOPAGO_TERMINAL") {
      const { prisma } = await import("@/lib/prisma");
      const terminal = await prisma.mercadoPagoTerminal.findUnique({ where: { branchId: order.branchId } });
      if (!terminal) {
        return NextResponse.json({ error: "Esta sucursal no tiene una terminal vinculada" }, { status: 400 });
      }
      pointOrder = await mercadoPagoService.createPointOrder(companyId, order.id, Number(order.total), terminal.terminalId);
    }

    return NextResponse.json({ order, mpCheckout, pointOrder });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo cerrar la cuenta";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
