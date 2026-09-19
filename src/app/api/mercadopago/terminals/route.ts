import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { mercadoPagoService } from "@/modules/mercadoPago/service";

/** Terminales Point disponibles en la cuenta de Mercado Pago conectada, para elegir cuál vincular. */
export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.PAGOS_INTEGRADOS))) {
    return NextResponse.json({ error: "Tu plan no incluye Pagos integrados" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para ver terminales" }, { status: 403 });
  }

  try {
    const terminals = await mercadoPagoService.listTerminals(companyId);
    const linked = await prisma.mercadoPagoTerminal.findMany({ where: { companyId } });
    return NextResponse.json({ terminals, linked });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo obtener la lista de terminales";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Vincula una terminal a la sucursal del usuario actual y la deja en modo PDV. */
export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.PAGOS_INTEGRADOS))) {
    return NextResponse.json({ error: "Tu plan no incluye Pagos integrados" }, { status: 403 });
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para vincular terminales" }, { status: 403 });
  }

  const branchId = await resolveBranchId(ctx, companyId);
  if (!branchId) {
    return NextResponse.json({ error: "La empresa no tiene sucursales configuradas" }, { status: 400 });
  }

  const body = await req.json();
  const { terminalId, label, posId, storeId } = body as {
    terminalId?: string;
    label?: string;
    posId?: number;
    storeId?: string;
  };
  if (!terminalId || !label) {
    return NextResponse.json({ error: "Falta el id de la terminal o el nombre" }, { status: 400 });
  }

  try {
    if (posId) {
      await mercadoPagoService.setTerminalPdvMode(companyId, terminalId, posId);
    }

    const linked = await prisma.mercadoPagoTerminal.upsert({
      where: { branchId },
      update: { terminalId, label, posId, storeId },
      create: { companyId, branchId, terminalId, label, posId, storeId },
    });

    return NextResponse.json({ linked });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo vincular la terminal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
