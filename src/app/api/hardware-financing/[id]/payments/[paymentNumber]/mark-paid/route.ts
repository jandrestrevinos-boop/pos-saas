import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant-context";
import { hardwareFinancingService } from "@/modules/hardwareFinancing/service";

const bodySchema = z.object({ note: z.string().max(200).optional() });

/**
 * POST /api/hardware-financing/[id]/payments/[paymentNumber]/mark-paid
 *
 * Registra manualmente una mensualidad normal como pagada (efectivo,
 * transferencia, etc.) mientras Mercado Pago no esté conectado. Distinto
 * de /payoff (liquidación total) y /abono (pago parcial extra) — esto es
 * exactamente UNA de las mensualidades ya programadas en el calendario.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string; paymentNumber: string } }
) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const paymentNumber = parseInt(params.paymentNumber, 10);
  if (Number.isNaN(paymentNumber)) {
    return NextResponse.json({ error: "Número de pago inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const financing = await hardwareFinancingService.markInstallmentPaid({
      financingId: params.id,
      paymentNumber,
      performedById: ctx.userId,
      note: parsed.data.note,
    });
    return NextResponse.json({ financing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo registrar el pago";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
