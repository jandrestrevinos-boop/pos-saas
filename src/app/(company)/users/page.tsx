import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { usersService } from "@/modules/users/service";
import { prisma } from "@/lib/prisma";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const companyId = session!.user.companyId!;

  const [users, roles, subscription] = await Promise.all([
    usersService.list(companyId),
    prisma.role.findMany({ where: { name: { not: "SUPER_ADMIN" } }, orderBy: { name: "asc" } }),
    prisma.subscription.findUnique({ where: { companyId }, include: { license: true, plan: true } }),
  ]);

  const userLimit = subscription?.license?.allowedUsers ?? null;

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Usuarios</h1>
      <p className="text-muted text-sm mb-8">
        Tu equipo dentro de la plataforma.
        {userLimit !== null && (
          <span className="ml-2 text-xs font-medium">
            ({users.length} de {userLimit} usuarios de tu plan {subscription?.plan.name})
          </span>
        )}
      </p>
      <UsersTable initialUsers={JSON.parse(JSON.stringify(users))} roles={JSON.parse(JSON.stringify(roles))} />
    </div>
  );
}
