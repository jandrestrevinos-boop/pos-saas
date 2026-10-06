import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { resolveBranchId } from "@/lib/tenant-context";
import { loyaltyService } from "@/modules/loyalty/service";
import { loyaltyGuard, errorResponse } from "@/modules/loyalty/guard";

const schema = z.object({ customerId: z.string().min(1) });

export async function POST(req: Request) {
  const g = await loyaltyGuard(PERMISSIONS.LOYALTY_SCAN);
  if (g.error) return g.error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Cliente inválido" }, { status: 400 });
  try {
    const branchId = await resolveBranchId(g.ctx, g.companyId);
    const customer = await loyaltyService.redeem(g.companyId, g.ctx.userId, branchId, parsed.data.customerId);
    return NextResponse.json({ customer });
  } catch (err) {
    return errorResponse(err, "No se pudo canjear el descuento");
  }
}
