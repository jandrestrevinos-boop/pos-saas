import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLE_PERMISSIONS } from "../src/lib/permissions";

const prisma = new PrismaClient();

async function main() {
  console.log("Creando permisos y roles...");

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

  const roles = await Promise.all(
    Object.keys(DEFAULT_ROLE_PERMISSIONS).map((roleName) =>
      prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      })
    )
  );

  for (const role of roles) {
    const keys = DEFAULT_ROLE_PERMISSIONS[role.name];
    for (const key of keys) {
      const permission = permissionByKey.get(key)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  console.log("Creando plan y usuario SUPER_ADMIN de plataforma...");

  const sharedFeatures = [
    "Productos e inventario",
    "Ventas y Punto de Venta",
    "Clientes",
    "Corte de caja",
    "Tickets",
    "Dashboard",
    "Reportes",
    "Promociones y descuentos",
  ];

  const basicoFeatures = ["1 sucursal", "Hasta 2 cajas", "Hasta 3 usuarios", ...sharedFeatures, "Soporte estándar"];

  const profesionalFeatures = [
    "1 sucursal",
    "Hasta 3 cajas",
    "Hasta 5 usuarios",
    ...sharedFeatures,
    "Pantalla de cocina (sin impresora)",
    "Historial de movimientos",
    "Exportación de información",
    "Soporte estándar",
  ];

  const empresarialFeatures = [
    "Multi-sucursal",
    "Cajas ampliadas",
    "Usuarios ampliados",
    ...sharedFeatures,
    "Pantalla de cocina (sin impresora)",
    "Historial de movimientos",
    "Exportación de información",
    "Administración centralizada",
    "Permisos avanzados por rol",
    "Auditoría",
    "Soporte prioritario",
  ];

  const planBasico = await prisma.plan.upsert({
    where: { name: "Básico" },
    update: {
      maxBranches: 1,
      maxUsers: 3,
      maxCashRegisters: 2,
      priceMxn: 299,
      features: basicoFeatures,
    },
    create: {
      name: "Básico",
      maxBranches: 1,
      maxUsers: 3,
      maxCashRegisters: 2,
      priceMxn: 299,
      features: basicoFeatures,
    },
  });

  await prisma.plan.upsert({
    where: { name: "Profesional" },
    update: {
      maxBranches: 1,
      maxUsers: 5,
      maxCashRegisters: 3,
      priceMxn: 599,
      features: profesionalFeatures,
    },
    create: {
      name: "Profesional",
      maxBranches: 1,
      maxUsers: 5,
      maxCashRegisters: 3,
      priceMxn: 599,
      features: profesionalFeatures,
    },
  });

  await prisma.plan.upsert({
    where: { name: "Empresarial" },
    update: {
      maxBranches: 10,
      maxUsers: 20,
      maxCashRegisters: 10,
      priceMxn: 999,
      features: empresarialFeatures,
    },
    create: {
      name: "Empresarial",
      maxBranches: 10,
      maxUsers: 20,
      maxCashRegisters: 10,
      priceMxn: 999,
      features: empresarialFeatures,
    },
  });

  const superAdminRole = roles.find((r) => r.name === "SUPER_ADMIN")!;
  await prisma.user.upsert({
    where: { email: "superadmin@plataforma.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "superadmin@plataforma.com",
      passwordHash: await bcrypt.hash("SuperAdmin123!", 10),
      roleId: superAdminRole.id,
      companyId: null,
      branchId: null,
    },
  });

  console.log("Creando empresa demo: Taquería Demo...");

  const company = await prisma.company.upsert({
    where: { id: "demo-company-id" },
    update: {},
    create: {
      id: "demo-company-id",
      name: "Taquería Demo",
      status: "ACTIVE",
    },
  });

  await prisma.subscription.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      planId: planBasico.id,
      status: "ACTIVE",
      license: {
        create: { allowedBranches: 1, allowedUsers: 5, allowedCashRegisters: 1 },
      },
    },
  });

  const branch = await prisma.branch.upsert({
    where: { id: "demo-branch-id" },
    update: {},
    create: { id: "demo-branch-id", companyId: company.id, name: "Principal" },
  });

  console.log("Creando usuarios demo...");

  const demoUsers = [
    { email: "admin@taqueriademo.com", name: "Admin Taquería", role: "ADMIN_EMPRESA" },
    { email: "gerente@taqueriademo.com", name: "Gerente Principal", role: "GERENTE" },
    { email: "cajero@taqueriademo.com", name: "Cajero Uno", role: "CAJERO" },
    { email: "mesero@taqueriademo.com", name: "Mesero Uno", role: "MESERO" },
  ];

  for (const u of demoUsers) {
    const role = roles.find((r) => r.name === u.role)!;
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        passwordHash: await bcrypt.hash("Demo123!", 10),
        roleId: role.id,
        companyId: company.id,
        branchId: branch.id,
      },
    });
  }

  console.log("Creando categorías y productos demo...");

  const categoriesData = [
    { name: "Tacos", products: [
      { name: "Taco Pastor", price: 18 },
      { name: "Taco Bistec", price: 20 },
      { name: "Taco Suadero", price: 18 },
      { name: "Taco Pollo", price: 18 },
    ]},
    { name: "Bebidas", products: [
      { name: "Coca-Cola", price: 25 },
      { name: "Agua", price: 15 },
      { name: "Agua de Horchata", price: 20 },
    ]},
    { name: "Extras", products: [
      { name: "Quesadilla", price: 30 },
    ]},
  ];

  for (const [i, cat] of categoriesData.entries()) {
    const category = await prisma.category.create({
      data: { companyId: company.id, name: cat.name, sortOrder: i },
    });
    for (const p of cat.products) {
      await prisma.product.create({
        data: {
          companyId: company.id,
          categoryId: category.id,
          name: p.name,
          price: p.price,
          taxRate: 0,
          isActive: true,
        },
      });
    }
  }

  console.log("Seed completado con éxito.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
