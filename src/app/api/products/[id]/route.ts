import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { productsService, productSchema } from "@/modules/products/service";
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

    // Antes esta ruta mandaba el body crudo del formulario directo a
    // Prisma, sin pasar por el schema — funcionaba de casualidad con
    // campos de texto/decimal (Prisma los acepta como string), pero
    // truena silenciosamente con "stock" (entero real en la base de
    // datos): el formulario lo manda como texto ("100") y Prisma lo
    // rechaza. .partial() porque en un PATCH no todos los campos son
    // obligatorios como sí lo son al crear.
    const parsed = productSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    // Si viene un precio nuevo, guarda el antes/después en la auditoría —
    // es de las ediciones más sensibles que puede hacer un empleado.
    const before =
      typeof parsed.data.price !== "undefined"
        ? await prisma.product.findUnique({ where: { id: params.id }, select: { price: true, name: true } })
        : null;

    const product = await productsService.update(companyId, params.id, parsed.data);

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
