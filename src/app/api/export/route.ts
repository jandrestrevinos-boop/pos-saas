import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { exportsService, EXPORT_DATASETS, type ExportDataset } from "@/modules/exports/service";

/** Qué permiso exige cada exportación (el mismo que ya protege esa información en pantalla). */
const REQUIRED_PERMISSION: Record<ExportDataset, PermissionKey> = {
  sales: PERMISSIONS.REPORTS_VIEW,
  customers: PERMISSIONS.REPORTS_VIEW,
  products: PERMISSIONS.PRODUCTS_MANAGE,
  stock: PERMISSIONS.INVENTORY_MANAGE,
  movements: PERMISSIONS.INVENTORY_MANAGE,
};

/**
 * GET /api/export?dataset=sales|products|stock|movements|customers[&from=YYYY-MM-DD&to=YYYY-MM-DD]
 * Descarga un CSV. from/to aplican a ventas y movimientos de inventario.
 */
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await getTenantContext();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (ctx.isSuperAdmin || !ctx.companyId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const companyId = requireCompanyId(ctx);

  const url = new URL(req.url);
  const dataset = url.searchParams.get("dataset") as ExportDataset | null;
  if (!dataset || !EXPORT_DATASETS.includes(dataset)) {
    return NextResponse.json({ error: "Tipo de exportación no válido" }, { status: 400 });
  }
  if (!hasPermission(ctx.permissions, REQUIRED_PERMISSION[dataset])) {
    return NextResponse.json({ error: "No tienes permiso para exportar esta información" }, { status: 403 });
  }

  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if ((from && !isoDate.test(from)) || (to && !isoDate.test(to))) {
    return NextResponse.json({ error: "Fechas no válidas (usa AAAA-MM-DD)" }, { status: 400 });
  }

  const { filename, csv, rows } = await exportsService.build(companyId, dataset, {
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(`${to}T23:59:59`) : undefined,
  });

  await prisma.auditLog.create({
    data: {
      companyId,
      userId: ctx.userId,
      action: "DATA_EXPORT",
      entity: "Export",
      entityId: dataset,
      newData: { dataset, from, to, rows },
    },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
