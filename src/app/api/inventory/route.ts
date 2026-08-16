import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { inventoryService, movementSchema } from "@/modules/inventory/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  const [products, movements] = await Promise.all([
    inventoryService.listTrackedProducts(companyId),
    inventoryService.listMovements(companyId),
  ]);

  return NextResponse.json({ products, movements });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.INVENTORY_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) return NextResponse.json({ error: "Sin sucursales configuradas" }, { status: 400 });

  const body = await req.json();
  const parsed = movementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const movement = await inventoryService.registerMovement(companyId, branchId, ctx.userId, parsed.data);
    return NextResponse.json({ movement }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo registrar el movimiento";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
