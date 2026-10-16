import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { cashService, closeRegisterSchema } from "@/modules/cash/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cash/close — Corte Z: cierra el día de caja de la sucursal.
 * Solo quien tenga cash.report_z (Administrador y Gerente por defecto).
 */
export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.CASH_REPORT_Z)) {
    return NextResponse.json({ error: "Solo un Gerente o Administrador puede hacer el corte Z" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) return NextResponse.json({ error: "Sin sucursales configuradas" }, { status: 400 });

  const body = await req.json();
  const parsed = closeRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });

  try {
    const { updated, report } = await cashService.closeDay({
      companyId,
      branchId,
      userId: ctx.userId,
      userName: user?.name ?? "—",
      countedCash: parsed.data.countedCash,
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId: ctx.userId,
        action: "CASH_CLOSE",
        entity: "CashRegister",
        entityId: updated.id,
        newData: { difference: report.cash.difference, folio: report.folio },
      },
    });

    return NextResponse.json({ register: updated, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo hacer el corte Z";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
