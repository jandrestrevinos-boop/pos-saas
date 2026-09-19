import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { mercadoPagoService } from "@/modules/mercadoPago/service";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  const account = await mercadoPagoService.getAccount(companyId);
  return NextResponse.json({
    connected: !!account,
    liveMode: account?.liveMode ?? null,
    connectedAt: account?.connectedAt ?? null,
  });
}

export async function DELETE() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para desconectar Mercado Pago" }, { status: 403 });
  }

  await mercadoPagoService.disconnect(companyId);
  return NextResponse.json({ ok: true });
}
