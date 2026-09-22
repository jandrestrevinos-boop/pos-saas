import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

/** Auditoría avanzada: consulta el registro de acciones sensibles de la empresa, con filtros. */
export async function GET(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para ver la auditoría" }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const action = url.searchParams.get("action");

  const logs = await prisma.auditLog.findMany({
    where: {
      companyId,
      ...(action ? { action } : {}),
      createdAt: {
        ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
      },
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const actions = await prisma.auditLog.findMany({
    where: { companyId },
    select: { action: true },
    distinct: ["action"],
  });

  return NextResponse.json({ logs, actions: actions.map((a: { action: string }) => a.action) });
}
