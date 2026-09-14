import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { companiesService } from "@/modules/companies/service";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const changePlanSchema = z.object({
  planId: z.string().min(1),
  useCustomPlan: z.boolean().optional(),
  customPriceMxn: z.coerce.number().min(0).nullable().optional(),
  customFeatures: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = changePlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const company = await companiesService.changePlan(params.id, parsed.data.planId, {
      useCustomPlan: parsed.data.useCustomPlan ?? false,
      customPriceMxn: parsed.data.customPriceMxn ?? null,
      customFeatures: parsed.data.customFeatures ?? [],
    });

    await prisma.auditLog.create({
      data: {
        companyId: params.id,
        userId: ctx.userId,
        action: "UPDATE",
        entity: "Subscription",
        newData: { planId: parsed.data.planId, useCustomPlan: parsed.data.useCustomPlan ?? false },
      },
    });

    return NextResponse.json({ company });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo cambiar el plan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
