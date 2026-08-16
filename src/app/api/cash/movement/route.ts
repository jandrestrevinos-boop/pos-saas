import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { cashService, movementSchema } from "@/modules/cash/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.CASH_MOVEMENT)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) return NextResponse.json({ error: "Sin sucursales configuradas" }, { status: 400 });

  const body = await req.json();
  const parsed = movementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const status = await cashService.getStatus(branchId);
  if (!status.open) return NextResponse.json({ error: "La caja no está abierta" }, { status: 400 });

  try {
    const movement = await cashService.addMovement(status.register.id, ctx.userId, parsed.data);
    return NextResponse.json({ movement }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo registrar el movimiento";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
