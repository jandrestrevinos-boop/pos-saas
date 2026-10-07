import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cashAuditService } from "@/modules/cash/audit";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  // Muestra dinero y errores de cada cajero: mismo permiso que la Auditoría general.
  if (!hasPermission(ctx.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para ver la auditoría de cajas" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from") ?? "";
  const toStr = searchParams.get("to") ?? "";
  if (!DATE_RE.test(fromStr) || !DATE_RE.test(toStr)) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }
  const branchId = searchParams.get("branchId") || undefined;

  const [report, branches] = await Promise.all([
    cashAuditService.report(companyId, {
      from: new Date(`${fromStr}T00:00:00`),
      to: new Date(`${toStr}T23:59:59.999`),
      branchId,
    }),
    prisma.branch.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({ ...report, branches });
}
