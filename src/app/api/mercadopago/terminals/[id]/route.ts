import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para desvincular terminales" }, { status: 403 });
  }

  await prisma.mercadoPagoTerminal.deleteMany({ where: { id: params.id, companyId } });
  return NextResponse.json({ ok: true });
}
