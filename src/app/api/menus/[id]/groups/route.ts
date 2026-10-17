import { NextResponse } from "next/server";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { requireCatalogManage, errorResponse } from "@/lib/manage-guard";
import { menusService, menuGroupsSchema } from "@/modules/menus/service";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireCatalogManage(FEATURE_KEYS.MENUS_COMPLETOS, "Menús completos");
  if (!guard.ok) return guard.response;

  const parsed = menuGroupsSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const menu = await menusService.setGroups(guard.companyId, params.id, parsed.data);
    return NextResponse.json({ menu });
  } catch (err) {
    return errorResponse(err, "No se pudieron guardar los grupos del menú");
  }
}
