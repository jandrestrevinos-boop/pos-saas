import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { prisma } from "@/lib/prisma";
import { addDays, localParts } from "@/lib/attendance";
import { attendanceService } from "@/modules/attendance/service";
import { ReportClient } from "./report-client";

export const dynamic = "force-dynamic";

export default async function ReporteChecadorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");
  const companyId = session.user.companyId;

  if (!hasPermission(session.user.permissions, PERMISSIONS.USERS_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions));
  }
  if (!(await hasFeature(companyId, FEATURE_KEYS.CHECADOR_ASISTENCIA))) redirect("/checador");

  const settings = await attendanceService.getSettings(companyId);
  const today = localParts(new Date(), settings.timezone).ymd;
  const [employees, branches] = await Promise.all([
    prisma.employee.findMany({ where: { companyId }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1">Checador: reporte</h1>
          <p className="text-muted text-sm">Horas, retardos, faltas y registro completo de entradas y salidas.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/checador" className="rounded-md border border-line bg-white px-3 py-2 font-medium hover:bg-paper">
            Quiosco
          </Link>
          <Link href="/checador/empleados" className="rounded-md border border-line bg-white px-3 py-2 font-medium hover:bg-paper">
            Empleados
          </Link>
        </div>
      </div>
      <ReportClient
        employees={employees}
        branches={branches}
        timezone={settings.timezone}
        defaultFrom={addDays(today, -6)}
        defaultTo={today}
        today={today}
      />
    </div>
  );
}
