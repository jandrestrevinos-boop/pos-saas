import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions";
import { loyaltyService, programSchema } from "@/modules/loyalty/service";
import { loyaltyGuard, errorResponse } from "@/modules/loyalty/guard";

export async function GET() {
  const g = await loyaltyGuard(PERMISSIONS.LOYALTY_MANAGE);
  if (g.error) return g.error;

  const [program, stats] = await Promise.all([loyaltyService.getProgram(g.companyId), loyaltyService.stats(g.companyId)]);
  return NextResponse.json({ program, stats });
}

export async function PATCH(req: Request) {
  const g = await loyaltyGuard(PERMISSIONS.LOYALTY_MANAGE);
  if (g.error) return g.error;

  const parsed = programSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  try {
    const program = await loyaltyService.updateProgram(g.companyId, g.ctx.userId, parsed.data);
    return NextResponse.json({ program });
  } catch (err) {
    return errorResponse(err, "No se pudo guardar el programa");
  }
}
