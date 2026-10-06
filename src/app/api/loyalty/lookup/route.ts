import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { loyaltyService } from "@/modules/loyalty/service";
import { loyaltyGuard, errorResponse } from "@/modules/loyalty/guard";

const schema = z.object({ code: z.string().min(1).max(500) });

export async function POST(req: Request) {
  const g = await loyaltyGuard(PERMISSIONS.LOYALTY_SCAN);
  if (g.error) return g.error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  try {
    const customer = await loyaltyService.lookup(g.companyId, parsed.data.code);
    return NextResponse.json({ customer });
  } catch (err) {
    return errorResponse(err, "No se pudo buscar la tarjeta");
  }
}
