/**
 * Script de una sola vez: sincroniza Permission + RolePermission en la
 * base de datos contra DEFAULT_ROLE_PERMISSIONS del código, SIN tocar
 * planes, empresas, categorías ni productos (a diferencia de seed.ts
 * completo). Seguro de correr las veces que haga falta — todo es upsert.
 *
 * Uso: npx tsx prisma/add-missing-permissions.ts
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLE_PERMISSIONS } from "../src/lib/permissions";

const prisma = new PrismaClient();

async function main() {
  const allPermissionKeys = new Set(Object.values(DEFAULT_ROLE_PERMISSIONS).flat());

  const permissionRecords = await Promise.all(
    Array.from(allPermissionKeys).map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, label: key },
      })
    )
  );
  const permissionByKey = new Map(permissionRecords.map((p) => [p.key, p]));

  for (const roleName of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    for (const key of DEFAULT_ROLE_PERMISSIONS[roleName as keyof typeof DEFAULT_ROLE_PERMISSIONS]) {
      const permission = permissionByKey.get(key)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
      console.log(`✓ ${roleName} → ${key}`);
    }
  }

  console.log("Permisos sincronizados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
