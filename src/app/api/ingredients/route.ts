import { NextResponse } from "next/server";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { requireCatalogManage, errorResponse } from "@/lib/manage-guard";
import { recipesService, ingredientSchema } from "@/modules/recipes/service";

const LABEL = "Costeo por receta";

export async function GET() {
  const guard = await requireCatalogManage(FEATURE_KEYS.COSTEO_RECETA, LABEL);
  if (!guard.ok) return guard.response;
  const ingredients = await recipesService.listIngredients(guard.companyId);
  return NextResponse.json({ ingredients });
}

export async function POST(req: Request) {
  const guard = await requireCatalogManage(FEATURE_KEYS.COSTEO_RECETA, LABEL);
  if (!guard.ok) return guard.response;

  const parsed = ingredientSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const ingredient = await recipesService.createIngredient(guard.companyId, parsed.data);
    return NextResponse.json({ ingredient }, { status: 201 });
  } catch (err) {
    return errorResponse(err, "No se pudo crear el insumo");
  }
}
