import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { productsService, productSchema } from "@/modules/products/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);
  const products = await productsService.list(companyId);
  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.PRODUCTS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const product = await productsService.create(companyId, parsed.data);
  return NextResponse.json({ product }, { status: 201 });
}
