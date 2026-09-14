import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { companiesService } from "@/modules/companies/service";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/companies/[id]/cancel
 *
 * Cancela la suscripción de TAPI de verdad (distinto de "Suspender", que
 * ya existía). Bloquea si hay financiamiento de hardware con saldo
 * pendiente, salvo que la política comercial (PlatformSettings) lo permita.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const company = await companiesService.cancelSubscription(params.id);

    await prisma.auditLog.create({
      data: { companyId: params.id, userId: ctx.userId, action: "CANCEL", entity: "Subscription", newData: { companyStatus: company.status } },
    });

    return NextResponse.json({ company });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo cancelar la suscripción";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
