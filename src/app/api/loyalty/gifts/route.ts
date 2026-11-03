import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { loyaltyService } from "@/modules/loyalty/service";
import { loyaltyGuard, errorResponse } from "@/modules/loyalty/guard";

export async function GET() {
  const g = await loyaltyGuard(PERMISSIONS.LOYALTY_MANAGE);
  if (g.error) return g.error;
  try {
    return NextResponse.json({ gifts: await loyaltyService.listGifts(g.companyId) });
  } catch (err) {
    return errorResponse(err, "No se pudo cargar el catálogo de regalos");
  }
}

// Un regalo (vinculado a un producto del POS con productId, o escrito a mano con name)
// o una lista completa (names: un producto por línea, pegada o leída de un archivo).
const schema = z.union([
  z.object({
    name: z.string().max(120).optional(),
    description: z.string().max(300).nullable().optional(),
    productId: z.string().min(1).nullable().optional(),
  }),
  z.object({ names: z.array(z.string().max(120)).min(1).max(500) }),
]);

export async function POST(req: Request) {
  const g = await loyaltyGuard(PERMISSIONS.LOYALTY_MANAGE);
  if (g.error) return g.error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  try {
    if ("names" in parsed.data) {
      const result = await loyaltyService.createGiftsBulk(g.companyId, g.ctx.userId, parsed.data.names);
      return NextResponse.json(result, { status: 201 });
    }
    const gift = await loyaltyService.createGift(g.companyId, g.ctx.userId, parsed.data);
    return NextResponse.json({ gift }, { status: 201 });
  } catch (err) {
    return errorResponse(err, "No se pudo agregar el regalo");
  }
}
