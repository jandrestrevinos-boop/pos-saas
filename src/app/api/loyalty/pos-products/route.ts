import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions";
import { isLoyaltyOnly } from "@/lib/feature-gating";
import { loyaltyService } from "@/modules/loyalty/service";
import { loyaltyGuard, errorResponse } from "@/modules/loyalty/guard";

/** Productos del POS que se pueden vincular como regalo. Vacío en empresas "solo clientes frecuentes". */
export async function GET(req: Request) {
  const g = await loyaltyGuard(PERMISSIONS.LOYALTY_MANAGE);
  if (g.error) return g.error;

  if (await isLoyaltyOnly(g.companyId)) return NextResponse.json({ products: [] });

  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  try {
    return NextResponse.json({ products: await loyaltyService.listPosProducts(g.companyId, q) });
  } catch (err) {
    return errorResponse(err, "No se pudieron cargar los productos");
  }
}
