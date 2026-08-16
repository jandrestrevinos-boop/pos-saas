import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { salesService, saleSchema } from "@/modules/sales/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.SALES_CREATE)) {
    return NextResponse.json({ error: "No tienes permiso para registrar ventas" }, { status: 403 });
  }

  const resolvedBranchId = await resolveBranchId(ctx, companyId);
  if (!resolvedBranchId) {
    return NextResponse.json({ error: "La empresa no tiene sucursales configuradas" }, { status: 400 });
  }
  const branchId: string = resolvedBranchId;

  const { cashService } = await import("@/modules/cash/service");
  const cashStatus = await cashService.getStatus(branchId);
  if (!cashStatus.open) {
    return NextResponse.json({ error: "Debes abrir la caja antes de registrar ventas" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = saleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const order = await salesService.create(companyId, branchId, ctx.userId, parsed.data);

    await prisma.auditLog.create({
      data: { companyId, userId: ctx.userId, action: "SALE", entity: "Order", entityId: order.id, newData: { total: order.total } },
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo registrar la venta";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
