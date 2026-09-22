import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { AuditLogClient } from "./audit-log-client";

export default async function AuditLogPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Auditoría</h1>
      <p className="text-muted text-sm mb-8">Registro de acciones sensibles: ventas, cancelaciones, caja, precios, planes.</p>
      <AuditLogClient />
    </div>
  );
}
