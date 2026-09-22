import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { productsService } from "@/modules/products/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.PRODUCTS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const body = await req.json();

  try {
    if (typeof body.isActive === "boolean" && Object.keys(body).length === 1) {
      await productsService.setActive(companyId, params.id, body.isActive);
      return NextResponse.json({ ok: true });
    }

    // Si viene un precio nuevo, guarda el antes/después en la auditoría —
    // es de las ediciones más sensibles que puede hacer un empleado.
    const before =
      typeof body.price !== "undefined"
        ? await prisma.product.findUnique({ where: { id: params.id }, select: { price: true, name: true } })
        : null;

    const product = await productsService.update(companyId, params.id, body);

    if (before && product && before.price.toString() !== product.price.toString()) {
      await prisma.auditLog.create({
        data: {
          companyId,
          userId: ctx.userId,
          action: "PRODUCT_PRICE_UPDATE",
          entity: "Product",
          entityId: params.id,
          previousData: { name: before.name, price: before.price.toString() },
          newData: { name: product.name, price: product.price.toString() },
        },
      });
    }

    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
}