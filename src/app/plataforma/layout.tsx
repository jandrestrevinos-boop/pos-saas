import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SidebarNav } from "@/components/sidebar-nav";

const NAV_ITEMS = [
  { href: "/plataforma/dashboard", label: "Dashboard" },
  { href: "/plataforma/companies", label: "Empresas" },
  { href: "/plataforma/plans", label: "Planes" },
];

export default async function PlataformaLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex">
      <SidebarNav items={NAV_ITEMS} brand="Plataforma" userName={session.user.name ?? ""} />
      <main className="flex-1 p-8 bg-paper">{children}</main>
    </div>
  );
}
