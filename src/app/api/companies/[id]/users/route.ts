import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { usersService, createUserSchema } from "@/modules/users/service";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const users = await usersService.list(params.id);
  return NextResponse.json({ users });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const user = await usersService.create(params.id, parsed.data);

    await prisma.auditLog.create({
      data: { companyId: params.id, userId: ctx.userId, action: "CREATE", entity: "User", entityId: user.id },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear el usuario";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
