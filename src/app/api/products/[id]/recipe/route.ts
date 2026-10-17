import { NextResponse } from "next/server";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { requireCatalogManage, errorResponse } from "@/lib/manage-guard";
import { recipesService, recipeSchema } from "@/modules/recipes/service";

const LABEL = "Costeo por receta";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireCatalogManage(FEATURE_KEYS.COSTEO_RECETA, LABEL);
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json(await recipesService.getRecipe(guard.companyId, params.id));
  } catch (err) {
    return errorResponse(err, "No se pudo cargar la receta");
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireCatalogManage(FEATURE_KEYS.COSTEO_RECETA, LABEL);
  if (!guard.ok) return guard.response;

  const parsed = recipeSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    return NextResponse.json(await recipesService.setRecipe(guard.companyId, params.id, parsed.data, guard.ctx.userId));
  } catch (err) {
    return errorResponse(err, "No se pudo guardar la receta");
  }
}
