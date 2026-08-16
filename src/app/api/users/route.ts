import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { usersService, createUserSchema } from "@/modules/users/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);
  const users = await usersService.list(companyId);
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.USERS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const user = await usersService.create(companyId, parsed.data);

    await prisma.auditLog.create({
      data: { companyId, userId: ctx.userId, action: "CREATE", entity: "User", entityId: user.id },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear el usuario";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
