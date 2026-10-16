import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { cashService } from "@/modules/cash/service";
import { cashReportService } from "@/modules/cash/report";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cash/report-x — Corte X: lectura parcial del día abierto de la sucursal.
 * No guarda ni cierra nada; se puede sacar las veces que se quiera.
 */
export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (
    !hasPermission(ctx.permissions, PERMISSIONS.CASH_REPORT_X) &&
    !hasPermission(ctx.permissions, PERMISSIONS.CASH_REPORT_Z)
  ) {
    return NextResponse.json({ error: "No tienes permiso para sacar el corte X" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) return NextResponse.json({ error: "Sin sucursales configuradas" }, { status: 400 });

  const register = await cashService.getOpenRegister(branchId);
  if (!register) return NextResponse.json({ error: "No hay un día de caja abierto en esta sucursal" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
  const report = await cashReportService.build(register.id, {
    kind: "X",
    upTo: new Date(),
    generatedBy: user?.name ?? null,
  });

  return NextResponse.json({ report });
}
