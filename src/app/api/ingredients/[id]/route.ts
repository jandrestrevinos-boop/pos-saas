import { NextResponse } from "next/server";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { requireCatalogManage, errorResponse } from "@/lib/manage-guard";
import { recipesService, ingredientSchema } from "@/modules/recipes/service";

const LABEL = "Costeo por receta";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireCatalogManage(FEATURE_KEYS.COSTEO_RECETA, LABEL);
  if (!guard.ok) return guard.response;

  const parsed = ingredientSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const ingredient = await recipesService.updateIngredient(guard.companyId, params.id, parsed.data, guard.ctx.userId);
    return NextResponse.json({ ingredient });
  } catch (err) {
    return errorResponse(err, "No se pudo actualizar el insumo");
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireCatalogManage(FEATURE_KEYS.COSTEO_RECETA, LABEL);
  if (!guard.ok) return guard.response;
  try {
    const result = await recipesService.deleteIngredient(guard.companyId, params.id);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "No se pudo eliminar el insumo");
  }
}
