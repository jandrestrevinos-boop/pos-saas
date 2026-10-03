import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant-context";
import { billingService, manualPaymentSchema } from "@/modules/billing/service";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("extend_trial"), days: z.coerce.number().int().min(1).max(365) }),
  z.object({ action: z.literal("manual_payment") }).merge(manualPaymentSchema),
]);

/**
 * POST /api/companies/[id]/billing — acciones de cobro de Jose sobre una empresa.
 *   { action: "extend_trial", days }
 *   { action: "manual_payment", months?, amountMxn?, note? }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const parsed = actionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    if (parsed.data.action === "extend_trial") {
      const result = await billingService.extendTrial(params.id, ctx.userId, parsed.data.days);
      return NextResponse.json({ ok: true, trialEndsAt: result.trialEndsAt.toISOString() });
    }

    const { months, amountMxn, note } = parsed.data;
    const result = await billingService.markManualPayment(params.id, ctx.userId, { months, amountMxn, note });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo completar la acción";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
