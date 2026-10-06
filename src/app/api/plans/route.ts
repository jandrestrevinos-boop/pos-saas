import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";
import { VALID_FEATURE_KEYS } from "@/lib/plan-features";
import { z } from "zod";

export async function GET() {
  await getTenantContext(); // requiere sesión activa
  const plans = await prisma.plan.findMany({ orderBy: { priceMxn: "asc" } });
  return NextResponse.json({ plans });
}

const createPlanSchema = z.object({
  name: z.string().trim().min(2, "El nombre del plan es obligatorio").max(60),
  priceMxn: z.coerce.number().positive("El precio mensual debe ser mayor a 0"),
  maxBranches: z.coerce.number().int().positive("Sucursales: mínimo 1"),
  maxUsers: z.coerce.number().int().positive("Usuarios: mínimo 1"),
  maxCashRegisters: z.coerce.number().int().positive("Cajas: mínimo 1"),
  features: z.array(z.string()).default([]),
});

/** Crea un plan nuevo (solo SUPER_ADMIN). Ej.: "Solo Clientes Frecuentes". */
export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const parsed = createPlanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.plan.findFirst({
    where: { name: { equals: parsed.data.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un plan con ese nombre" }, { status: 400 });
  }

  const plan = await prisma.plan.create({
    data: {
      ...parsed.data,
      features: parsed.data.features.filter((f) => VALID_FEATURE_KEYS.has(f)),
    },
  });

  await prisma.auditLog.create({
    data: { userId: ctx.userId, action: "CREATE", entity: "Plan", entityId: plan.id, newData: { name: plan.name } },
  });

  return NextResponse.json({ plan }, { status: 201 });
}
