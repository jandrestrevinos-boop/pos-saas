import { NextResponse } from "next/server";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { requireCatalogManage } from "@/lib/manage-guard";
import { recipesService } from "@/modules/recipes/service";

export async function GET() {
  const guard = await requireCatalogManage(FEATURE_KEYS.COSTEO_RECETA, "Costeo por receta");
  if (!guard.ok) return guard.response;
  return NextResponse.json({ products: await recipesService.costingReport(guard.companyId) });
}
