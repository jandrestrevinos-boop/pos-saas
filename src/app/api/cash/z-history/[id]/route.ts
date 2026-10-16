import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/** GET /api/cash/z-history/[id] — el corte Z congelado tal como se guardó al cerrar el día. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.CASH_REPORT_Z)) {
    return NextResponse.json({ error: "No tienes permiso para consultar los cortes Z" }, { status: 403 });
  }

  const register = await prisma.cashRegister.findFirst({
    where: { id: params.id, status: "CLOSED", branch: { companyId } },
    select: { zReport: true },
  });
  if (!register || !register.zReport) {
    return NextResponse.json({ error: "Corte Z no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ report: register.zReport });
}
