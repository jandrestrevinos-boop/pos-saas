import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions";
import { loyaltyService, enrollSchema } from "@/modules/loyalty/service";
import { loyaltyGuard, errorResponse } from "@/modules/loyalty/guard";

export async function POST(req: Request) {
  const g = await loyaltyGuard(PERMISSIONS.LOYALTY_SCAN);
  if (g.error) return g.error;

  const parsed = enrollSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const result = await loyaltyService.enrollByStaff(g.companyId, g.ctx.userId, parsed.data);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    return errorResponse(err, "No se pudo registrar al cliente");
  }
}
