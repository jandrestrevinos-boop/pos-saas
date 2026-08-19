import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { companiesService } from "@/modules/companies/service";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { status } = await req.json();
  if (status !== "ACTIVE" && status !== "SUSPENDED") {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  const company = await companiesService.setStatus(params.id, status);

  await prisma.auditLog.create({
    data: { userId: ctx.userId, action: "UPDATE", entity: "Company", entityId: company.id, newData: { status } },
  });

  return NextResponse.json({ company });
}


export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  await prisma.company.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}