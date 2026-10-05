import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext, requireCompanyId, ACTIVE_BRANCH_COOKIE } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/** POST /api/branches/active { branchId } — el administrador elige en qué sucursal operar. */
export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.BRANCHES_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const parsed = z.object({ branchId: z.string().min(1) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Sucursal no válida" }, { status: 400 });

  const branch = await prisma.branch.findFirst({
    where: { id: parsed.data.branchId, companyId, isActive: true },
    select: { id: true, name: true },
  });
  if (!branch) return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });

  const res = NextResponse.json({ ok: true, branch });
  res.cookies.set(ACTIVE_BRANCH_COOKIE, branch.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
