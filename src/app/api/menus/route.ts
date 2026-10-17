import { NextResponse } from "next/server";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { requireCatalogManage, errorResponse } from "@/lib/manage-guard";
import { menusService, menuSchema } from "@/modules/menus/service";

const LABEL = "Menús completos";

export async function GET() {
  const guard = await requireCatalogManage(FEATURE_KEYS.MENUS_COMPLETOS, LABEL);
  if (!guard.ok) return guard.response;
  return NextResponse.json({ menus: await menusService.list(guard.companyId) });
}

export async function POST(req: Request) {
  const guard = await requireCatalogManage(FEATURE_KEYS.MENUS_COMPLETOS, LABEL);
  if (!guard.ok) return guard.response;

  const parsed = menuSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const menu = await menusService.create(guard.companyId, parsed.data);
    return NextResponse.json({ menu }, { status: 201 });
  } catch (err) {
    return errorResponse(err, "No se pudo crear el menú");
  }
}
