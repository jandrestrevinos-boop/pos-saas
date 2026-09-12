import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { hardwareFinancingService, createFinancingSchema } from "@/modules/hardwareFinancing/service";

/**
 * GET /api/hardware-financing?companyId=...
 * POST /api/hardware-financing
 *
 * Solo SUPER_ADMIN (Jose/su equipo) crea y ve financiamientos — es una
 * operación comercial de la plataforma hacia la empresa, no algo que la
 * empresa se autogestione. Mismo criterio que /api/companies/[id]/plan.
 */
export async function GET(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const companyId = new URL(req.url).searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId es obligatorio" }, { status: 400 });
  }

  const financings = await hardwareFinancingService.list(companyId);
  return NextResponse.json({ financings });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createFinancingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const financing = await hardwareFinancingService.create(ctx.userId, parsed.data);
    return NextResponse.json({ financing }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear el financiamiento";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
