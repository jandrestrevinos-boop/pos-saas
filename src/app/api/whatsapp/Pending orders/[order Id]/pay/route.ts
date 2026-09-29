import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { salesService, payExistingOrderSchema } from "@/modules/sales/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { orderId: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.SALES_CREATE)) {
    return NextResponse.json({ error: "No tienes permiso para cobrar" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) return NextResponse.json({ error: "Sin sucursales configuradas" }, { status: 400 });

  const body = await req.json();
  const parsed = payExistingOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const order = await salesService.payExistingOrder(
      companyId,
      branchId,
      ctx.userId,
      params.orderId,
      parsed.data
    );

    await prisma.auditLog.create({
      data: {
        companyId,
        userId: ctx.userId,
        action: "WHATSAPP_ORDER_PAID",
        entity: "Order",
        entityId: params.orderId,
        newData: { method: parsed.data.paymentMethod },
      },
    });

    return NextResponse.json({ order });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo cobrar el pedido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
