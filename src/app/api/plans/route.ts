import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await getTenantContext(); // requiere sesión activa
  const plans = await prisma.plan.findMany({ orderBy: { priceMxn: "asc" } });
  return NextResponse.json({ plans });
}
