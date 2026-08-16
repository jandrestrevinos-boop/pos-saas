import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function RedirectAfterLogin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.roleName === "SUPER_ADMIN") {
    redirect("/plataforma/dashboard");
  }

  redirect("/dashboard");
}
