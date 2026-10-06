import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions";
import { loyaltyService } from "@/modules/loyalty/service";
import { loyaltyGuard, errorResponse } from "@/modules/loyalty/guard";

export async function POST() {
  const g = await loyaltyGuard(PERMISSIONS.LOYALTY_MANAGE);
  if (g.error) return g.error;
  try {
    const program = await loyaltyService.rotateSignupToken(g.companyId, g.ctx.userId);
    return NextResponse.json({ program });
  } catch (err) {
    return errorResponse(err, "No se pudo generar el QR nuevo");
  }
}
