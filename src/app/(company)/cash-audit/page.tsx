import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS, getHomeRoute } from "@/lib/permissions";
import { CashAuditClient } from "./cash-audit-client";

export default async function CashAuditPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    redirect(getHomeRoute(session.user.permissions));
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Auditoría de cajas</h1>
      <p className="text-muted text-sm mb-8">Cada turno de caja: quién lo abrió y cerró, y cuánto faltó o sobró.</p>
      <CashAuditClient />
    </div>
  );
}
