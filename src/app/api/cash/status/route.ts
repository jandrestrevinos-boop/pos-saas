import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { cashService } from "@/modules/cash/service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);
  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) return NextResponse.json({ error: "Sin sucursales configuradas" }, { status: 400 });

  const status = await cashService.getStatus(branchId);
  if (status.open) return NextResponse.json(status);

  // Sin día abierto: la pantalla de Caja explica si abrirlo es obligatorio para vender.
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { requireOpenCashDay: true } });
  return NextResponse.json({ ...status, requireOpenCashDay: company?.requireOpenCashDay ?? false });
}
