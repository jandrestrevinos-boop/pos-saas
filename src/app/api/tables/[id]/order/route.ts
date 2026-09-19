import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { tableTabsService } from "@/modules/tableTabs/service";

/** El ticket abierto actual de una mesa — usado por /tables y por el POS en modo mesa para pintar la cuenta corriente. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!(await hasFeature(companyId, FEATURE_KEYS.GESTION_MESAS))) {
    return NextResponse.json({ error: "Tu plan no incluye Gestión de mesas" }, { status: 403 });
  }

  const order = await tableTabsService.getOpenOrder(companyId, params.id);
  return NextResponse.json({ order });
}
