import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHomeRoute } from "@/lib/permissions";
import { isLoyaltyOnly } from "@/lib/feature-gating";

export default async function RedirectAfterLogin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.roleName === "SUPER_ADMIN") {
    redirect("/plataforma/dashboard");
  }

  // Antes mandaba a todos a /dashboard, pero un Mesero/Cajero/Cocinero ya
  // no tiene acceso ahí (sin REPORTS_VIEW) — cada quien entra a la primera
  // pantalla que sí puede usar.
  const loyaltyOnly = session.user.companyId ? await isLoyaltyOnly(session.user.companyId) : false;
  redirect(getHomeRoute(session.user.permissions, { loyaltyOnly }));
}
