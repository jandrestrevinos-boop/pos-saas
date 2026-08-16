import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { cashService, closeRegisterSchema } from "@/modules/cash/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.CASH_CLOSE)) {
    return NextResponse.json({ error: "No tienes permiso para cerrar caja" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) return NextResponse.json({ error: "Sin sucursales configuradas" }, { status: 400 });

  const body = await req.json();
  const parsed = closeRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const status = await cashService.getStatus(branchId);
  if (!status.open) return NextResponse.json({ error: "La caja no está abierta" }, { status: 400 });

  try {
    const register = await cashService.close(status.register.id, branchId, parsed.data.countedCash);

    await prisma.auditLog.create({
      data: { companyId, userId: ctx.userId, action: "CASH_CLOSE", entity: "CashRegister", entityId: register.id, newData: { difference: register.difference } },
    });

    return NextResponse.json({ register });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo cerrar la caja";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
