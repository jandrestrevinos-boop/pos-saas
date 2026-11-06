import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { attendanceService } from "@/modules/attendance/service";
import { KioskClient } from "./kiosk-client";

export const dynamic = "force-dynamic";

export default async function ChecadorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");
  const companyId = session.user.companyId;

  if (!(await hasFeature(companyId, FEATURE_KEYS.CHECADOR_ASISTENCIA))) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold mb-1">Checador</h1>
        <p className="text-muted text-sm max-w-md mt-6">
          El checador de asistencia no está incluido en tu plan. Contacta a Tappy para activarlo como complemento.
        </p>
      </div>
    );
  }

  const settings = await attendanceService.getSettings(companyId);
  const canManage = hasPermission(session.user.permissions, PERMISSIONS.USERS_MANAGE);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1">Checador</h1>
          <p className="text-muted text-sm">Cada empleado registra su entrada y salida con su número y PIN.</p>
        </div>
        {canManage && (
          <div className="flex gap-2 text-sm">
            <Link href="/checador/empleados" className="rounded-md border border-line bg-white px-3 py-2 font-medium hover:bg-paper">
              Empleados
            </Link>
            <Link href="/checador/reporte" className="rounded-md border border-line bg-white px-3 py-2 font-medium hover:bg-paper">
              Reporte
            </Link>
          </div>
        )}
      </div>
      <KioskClient requirePhoto={settings.requirePhoto} timezone={settings.timezone} />
    </div>
  );
}
