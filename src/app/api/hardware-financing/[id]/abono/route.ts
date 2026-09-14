import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant-context";
import { hardwareFinancingService } from "@/modules/hardwareFinancing/service";

const abonoSchema = z.object({
  amount: z.coerce.number().positive(),
  mercadoPagoPaymentId: z.string().optional(),
});

/**
 * POST /api/hardware-financing/[id]/abono
 *
 * Registra un abono extraordinario (sección 12 de la spec). Si el monto
 * cubre el saldo completo, el financiamiento queda LIQUIDATED igual que
 * con /payoff. Si es parcial, recalcula automáticamente saldo, número de
 * pagos, calendario y próximo vencimiento — sin tocar pagos ya registrados.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = abonoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const financing = await hardwareFinancingService.registerAbono({
      id: params.id,
      performedById: ctx.userId,
      amount: parsed.data.amount,
      mercadoPagoPaymentId: parsed.data.mercadoPagoPaymentId,
    });
    return NextResponse.json({ financing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo registrar el abono";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
