import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { prisma } from "@/lib/prisma";
import { attendanceService } from "@/modules/attendance/service";
import { EmployeesClient } from "./employees-client";

export const dynamic = "force-dynamic";

export default async function EmpleadosChecadorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");
  const companyId = session.user.companyId;

  if (!hasPermission(session.user.permissions, PERMISSIONS.USERS_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions));
  }
  if (!(await hasFeature(companyId, FEATURE_KEYS.CHECADOR_ASISTENCIA))) redirect("/checador");

  const [employees, settings, branches] = await Promise.all([
    attendanceService.listEmployees(companyId),
    attendanceService.getSettings(companyId),
    prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1">Checador: empleados</h1>
          <p className="text-muted text-sm">Da de alta a quien checa, asigna su PIN y su horario.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/checador" className="rounded-md border border-line bg-white px-3 py-2 font-medium hover:bg-paper">
            Quiosco
          </Link>
          <Link href="/checador/reporte" className="rounded-md border border-line bg-white px-3 py-2 font-medium hover:bg-paper">
            Reporte
          </Link>
        </div>
      </div>
      <EmployeesClient
        initialEmployees={JSON.parse(JSON.stringify(employees))}
        branches={branches}
        initialSettings={{
          timezone: settings.timezone,
          requirePhoto: settings.requirePhoto,
          lateToleranceMinutes: settings.lateToleranceMinutes,
        }}
      />
    </div>
  );
}
