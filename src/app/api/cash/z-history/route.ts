import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type ZRow = {
  id: string;
  folio: number | null;
  openedAt: Date;
  closedAt: Date | null;
  countedCash: unknown;
  expectedCash: unknown;
  difference: unknown;
  zReport: { sales?: { tickets?: number; total?: number } } | null;
  branch: { name: string };
};

/** GET /api/cash/z-history?branchId=&from=YYYY-MM-DD&to=YYYY-MM-DD — cortes Z ya hechos (solo cash.report_z). */
export async function GET(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.CASH_REPORT_Z)) {
    return NextResponse.json({ error: "No tienes permiso para consultar los cortes Z" }, { status: 403 });
  }

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId") || undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const closedAt: { gte?: Date; lte?: Date } = {};
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) closedAt.gte = new Date(`${from}T00:00:00`);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) closedAt.lte = new Date(`${to}T23:59:59.999`);

  const rows = (await prisma.cashRegister.findMany({
    where: {
      status: "CLOSED",
      folio: { not: null },
      branch: { companyId },
      ...(branchId ? { branchId } : {}),
      ...(closedAt.gte || closedAt.lte ? { closedAt } : {}),
    },
    select: {
      id: true,
      folio: true,
      openedAt: true,
      closedAt: true,
      countedCash: true,
      expectedCash: true,
      difference: true,
      zReport: true,
      branch: { select: { name: true } },
    },
    orderBy: { closedAt: "desc" },
    take: 200,
  })) as unknown as ZRow[];

  const branches = await prisma.branch.findMany({
    where: { companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    branches,
    cuts: rows.map((r) => ({
      id: r.id,
      folio: r.folio,
      branchName: r.branch.name,
      openedAt: r.openedAt.toISOString(),
      closedAt: r.closedAt ? r.closedAt.toISOString() : null,
      tickets: r.zReport?.sales?.tickets ?? 0,
      total: r.zReport?.sales?.total ?? 0,
      expectedCash: r.expectedCash === null ? null : Number(r.expectedCash),
      countedCash: r.countedCash === null ? null : Number(r.countedCash),
      difference: r.difference === null ? null : Number(r.difference),
    })),
  });
}
