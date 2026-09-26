import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { kitchenService } from "@/modules/kitchen/service";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  const enabled = await kitchenService.isEnabledForCompany(companyId);
  if (!enabled) {
    return NextResponse.json({ error: "Tu plan actual no incluye la Pantalla de Cocina" }, { status: 403 });
  }

  // El id de un ticket es "orderId:roundNumber" (ver kitchenService.listActive)
  const [orderId, roundNumberStr] = params.id.split(":");
  const roundNumber = Number(roundNumberStr);
  if (!orderId || !roundNumberStr || Number.isNaN(roundNumber)) {
    return NextResponse.json({ error: "Ticket inválido" }, { status: 400 });
  }

  try {
    const ticket = await kitchenService.advanceRound(companyId, orderId, roundNumber);
    return NextResponse.json({ ticket });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo actualizar el pedido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
