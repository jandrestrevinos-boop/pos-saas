import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  // Información financiera sensible: solo el Admin de la empresa la ve,
  // ni gerentes, cajeros ni meseros tienen acceso a este endpoint.
  if (ctx.roleName !== "ADMIN_EMPRESA") {
    return NextResponse.json({ error: "No tienes permiso para ver esta información" }, { status: 403 });
  }

  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const orders = await prisma.order.findMany({
    where: { companyId, createdAt: { gte: twelveMonthsAgo }, status: { not: "CANCELED" } },
    select: { total: true, createdAt: true },
  });

  const months: { key: string; label: string; total: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
    months.push({ key, label, total: 0 });
  }
  const monthByKey = new Map(months.map((m) => [m.key, m]));

  for (const order of orders) {
    const d = order.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const month = monthByKey.get(key);
    if (month) month.total += Number(order.total);
  }

  return NextResponse.json({ months });
}