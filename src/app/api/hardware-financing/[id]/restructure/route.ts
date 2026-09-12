import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant-context";
import { hardwareFinancingService } from "@/modules/hardwareFinancing/service";

const restructureSchema = z.object({
  newTotalInstallments: z.coerce.number().int().positive(),
  newPeriodicity: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]).optional(),
  newFirstPaymentDueDate: z.coerce.date(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = restructureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const financing = await hardwareFinancingService.restructure({
      id: params.id,
      performedById: ctx.userId,
      newTotalInstallments: parsed.data.newTotalInstallments,
      newPeriodicity: parsed.data.newPeriodicity,
      newFirstPaymentDueDate: parsed.data.newFirstPaymentDueDate,
    });
    return NextResponse.json({ financing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo reestructurar el financiamiento";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
