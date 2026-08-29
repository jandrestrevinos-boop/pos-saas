import { NextResponse } from "next/server";
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
    const product = await productsService.update(companyId, params.id, body);
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
}