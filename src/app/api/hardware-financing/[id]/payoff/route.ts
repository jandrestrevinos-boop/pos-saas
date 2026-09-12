import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { hardwareFinancingService } from "@/modules/hardwareFinancing/service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  try {
    const financing = await hardwareFinancingService.liquidateEarly(params.id, ctx.userId, body.mercadoPagoPaymentId);
    return NextResponse.json({ financing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo liquidar el financiamiento";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
