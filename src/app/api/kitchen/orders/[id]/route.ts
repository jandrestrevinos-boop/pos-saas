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

  try {
    const order = await kitchenService.advanceStatus(companyId, params.id);
    return NextResponse.json({ order });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo actualizar el pedido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
