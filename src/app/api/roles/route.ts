import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await getTenantContext(); // requiere sesión activa
  // SUPER_ADMIN se excluye: ese rol es exclusivo del dueño de la plataforma,
  // nunca se asigna a un usuario dentro de una empresa.
  const roles = await prisma.role.findMany({
    where: { name: { not: "SUPER_ADMIN" } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ roles });
}
