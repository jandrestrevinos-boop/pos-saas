import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { branchesService, branchUpdateSchema } from "@/modules/branches/service";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.BRANCHES_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const parsed = branchUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const branch = await branchesService.update(companyId, ctx.userId, params.id, parsed.data);
    return NextResponse.json({ branch });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo actualizar la sucursal" }, { status: 400 });
  }
}
