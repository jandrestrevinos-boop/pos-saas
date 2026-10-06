import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions";
import { loyaltyService } from "@/modules/loyalty/service";
import { loyaltyGuard, errorResponse } from "@/modules/loyalty/guard";

export async function GET(req: Request) {
  const g = await loyaltyGuard(PERMISSIONS.LOYALTY_MANAGE);
  if (g.error) return g.error;

  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  try {
    const customers = await loyaltyService.listCustomers(g.companyId, q);
    return NextResponse.json({ customers });
  } catch (err) {
    return errorResponse(err, "No se pudieron cargar los clientes");
  }
}
