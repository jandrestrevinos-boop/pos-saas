import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updatePlanSchema = z.object({
  priceMxn: z.coerce.number().positive().optional(),
  maxBranches: z.coerce.number().int().positive().optional(),
  maxUsers: z.coerce.number().int().positive().optional(),
  maxCashRegisters: z.coerce.number().int().positive().optional(),
  features: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updatePlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const plan = await prisma.plan.update({ where: { id: params.id }, data: parsed.data });

  // Los límites reales que se aplican a cada empresa viven en su License
  // (se copian del plan al crear la empresa o al cambiarle de plan). Si Jose
  // cambia aquí sucursales/usuarios/cajas, las empresas que ya están en este
  // plan deben recibir el nuevo límite también; si no, el cambio solo
  // afectaría a las empresas que se den de alta después.
  const limitsChanged =
    parsed.data.maxBranches !== undefined ||
    parsed.data.maxUsers !== undefined ||
    parsed.data.maxCashRegisters !== undefined;

  if (limitsChanged) {
    await prisma.license.updateMany({
      where: { subscription: { planId: plan.id } },
      data: {
        allowedBranches: plan.maxBranches,
        allowedUsers: plan.maxUsers,
        allowedCashRegisters: plan.maxCashRegisters,
      },
    });
  }

  return NextResponse.json({ plan });
}
