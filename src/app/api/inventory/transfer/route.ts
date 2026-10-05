import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { inventoryService, transferSchema } from "@/modules/inventory/service";

/**
 * POST /api/inventory/transfer — pasa mercancía de una sucursal a otra.
 * Exige poder administrar inventario Y sucursales: mover existencias entre
 * sucursales es una decisión del dueño/administrador, no del cajero.
 */
export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.INVENTORY_MANAGE) || !hasPermission(ctx.permissions, PERMISSIONS.BRANCHES_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para transferir inventario entre sucursales" }, { status: 403 });
  }

  const parsed = transferSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const transfer = await inventoryService.transfer(companyId, ctx.userId, parsed.data);
    return NextResponse.json({ transfer }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo hacer la transferencia" }, { status: 400 });
  }
}
