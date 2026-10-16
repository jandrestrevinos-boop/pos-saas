import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/companies/[id]/cash-settings  { requireOpenCashDay: boolean }
 *
 * Solo SUPER_ADMIN. Si está activo, la empresa no puede vender sin abrir antes el día de caja
 * (con su fondo inicial). Apagado (default): el día se abre solo con la primera venta.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.requireOpenCashDay !== "boolean") {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  }

  const company = await prisma.company.update({
    where: { id: params.id },
    data: { requireOpenCashDay: body.requireOpenCashDay },
    select: { id: true, requireOpenCashDay: true },
  });

  await prisma.auditLog.create({
    data: {
      companyId: params.id,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "Company",
      entityId: params.id,
      newData: { requireOpenCashDay: company.requireOpenCashDay },
    },
  });

  return NextResponse.json({ company });
}
