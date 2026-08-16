import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { cashService, openRegisterSchema } from "@/modules/cash/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.CASH_OPEN)) {
    return NextResponse.json({ error: "No tienes permiso para abrir caja" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) return NextResponse.json({ error: "Sin sucursales configuradas" }, { status: 400 });

  const body = await req.json();
  const parsed = openRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const register = await cashService.open(branchId, parsed.data.openingCash);

    await prisma.auditLog.create({
      data: { companyId, userId: ctx.userId, action: "CASH_OPEN", entity: "CashRegister", entityId: register.id },
    });

    return NextResponse.json({ register }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo abrir la caja";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
