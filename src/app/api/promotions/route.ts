import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { promotionsService, promotionSchema } from "@/modules/promotions/service";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);
  if (!hasPermission(ctx.permissions, PERMISSIONS.PRODUCTS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para ver las promociones" }, { status: 403 });
  }
  return NextResponse.json({ promotions: await promotionsService.list(companyId) });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);
  if (!hasPermission(ctx.permissions, PERMISSIONS.PRODUCTS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para crear promociones" }, { status: 403 });
  }

  const parsed = promotionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const promotion = await promotionsService.create(companyId, parsed.data);
    return NextResponse.json({ promotion }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("Unique") ? "Ya existe una promoción con ese cupón" : "No se pudo crear la promoción";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
