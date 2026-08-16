import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { categoriesService, categorySchema } from "@/modules/categories/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);
  const categories = await categoriesService.list(companyId);
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.CATEGORIES_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const category = await categoriesService.create(companyId, parsed.data.name);
  return NextResponse.json({ category }, { status: 201 });
}
