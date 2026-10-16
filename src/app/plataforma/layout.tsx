import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SidebarNav } from "@/components/sidebar-nav";

const NAV_ITEMS = [
  { href: "/plataforma/dashboard", label: "Dashboard" },
  { href: "/plataforma/companies", label: "Empresas" },
  { href: "/plataforma/plans", label: "Planes" },
  { href: "/plataforma/settings", label: "Configuración" },
];

export default async function PlataformaLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <SidebarNav items={NAV_ITEMS} brand="Tappy" userName={session.user.name ?? ""} />
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-8 bg-paper">{children}</main>
    </div>
  );
}
