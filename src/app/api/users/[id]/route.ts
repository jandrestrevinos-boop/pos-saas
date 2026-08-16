import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { usersService } from "@/modules/users/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.USERS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const { isActive } = await req.json();

  try {
    await usersService.setActive(companyId, params.id, isActive);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
}
