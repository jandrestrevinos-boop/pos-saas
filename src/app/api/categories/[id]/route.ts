import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { categoriesService } from "@/modules/categories/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.CATEGORIES_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const body = await req.json();
  try {
    const category = await categoriesService.update(companyId, params.id, body);
    return NextResponse.json({ category });
  } catch {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.CATEGORIES_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  try {
    await categoriesService.remove(companyId, params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }
}
