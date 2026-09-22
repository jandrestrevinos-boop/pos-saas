import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { DashboardEmpresarialClient } from "./dashboard-empresarial-client";
import Link from "next/link";

export default async function DashboardEmpresarialPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  const enabled = await hasFeature(session.user.companyId, FEATURE_KEYS.DASHBOARD_EMPRESARIAL);

  if (!enabled) {
    return (
      <div className="h-screen flex items-center justify-center bg-paper">
        <div className="text-center max-w-sm">
          <p className="font-display text-2xl font-semibold mb-2">Función no incluida en tu plan</p>
          <p className="text-muted text-sm mb-6">
            El Dashboard empresarial no está activo para tu empresa. Contacta a soporte para agregarlo a tu plan.
          </p>
          <Link href="/dashboard" className="inline-block rounded-md bg-ember text-white px-5 py-3 text-sm font-medium">
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (session.user.roleName !== "ADMIN_EMPRESA") {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Dashboard empresarial</h1>
      <p className="text-muted text-sm mb-8">Vista financiera completa de los últimos 30 días — solo visible para ti como Admin.</p>
      <DashboardEmpresarialClient />
    </div>
  );
}
