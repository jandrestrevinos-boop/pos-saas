import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: { id: string; userId: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const user = await prisma.user.findFirst({ where: { id: params.userId, companyId: params.id } });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  try {
    await prisma.user.delete({ where: { id: params.userId } });
  } catch {
    return NextResponse.json(
      { error: "No se puede eliminar: este usuario tiene ventas u operaciones registradas. Desactívalo en su lugar." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}