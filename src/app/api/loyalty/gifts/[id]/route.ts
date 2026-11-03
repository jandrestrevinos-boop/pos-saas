import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { loyaltyService } from "@/modules/loyalty/service";
import { loyaltyGuard, errorResponse } from "@/modules/loyalty/guard";

const patchSchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().max(300).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await loyaltyGuard(PERMISSIONS.LOYALTY_MANAGE);
  if (g.error) return g.error;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  try {
    const gift = await loyaltyService.updateGift(g.companyId, g.ctx.userId, params.id, parsed.data);
    return NextResponse.json({ gift });
  } catch (err) {
    return errorResponse(err, "No se pudo actualizar el regalo");
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await loyaltyGuard(PERMISSIONS.LOYALTY_MANAGE);
  if (g.error) return g.error;
  try {
    await loyaltyService.deleteGift(g.companyId, g.ctx.userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "No se pudo eliminar el regalo");
  }
}
