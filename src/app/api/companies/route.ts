import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { companiesService, createCompanySchema } from "@/modules/companies/service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const companies = await companiesService.list();
  return NextResponse.json({ companies });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const company = await companiesService.create(parsed.data);

  await prisma.auditLog.create({
    data: { userId: ctx.userId, action: "CREATE", entity: "Company", entityId: company.id, newData: company },
  });

  return NextResponse.json({ company }, { status: 201 });
}
