import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Este script SOLO toca la empresa "Taquería Demo" (id fijo del seed).
// Ninguna otra empresa (como Santo Coffee House) se ve afectada, gracias
// al aislamiento multiempresa: todo se filtra por companyId.
const DEMO_COMPANY_ID = "demo-company-id";

async function main() {
  const company = await prisma.company.findUnique({ where: { id: DEMO_COMPANY_ID } });
  if (!company) {
    console.log("No se encontró la empresa demo. Nada que limpiar.");
    return;
  }

  console.log(`Limpiando datos de prueba de: ${company.name}...`);

  // Orden importante: primero lo que depende de una orden/producto,
  // antes de borrar las órdenes y productos mismos.
  await prisma.orderItemModifier.deleteMany({ where: { orderItem: { order: { companyId: DEMO_COMPANY_ID } } } });
  await prisma.payment.deleteMany({ where: { order: { companyId: DEMO_COMPANY_ID } } });
  await prisma.orderItem.deleteMany({ where: { order: { companyId: DEMO_COMPANY_ID } } });
  await prisma.order.deleteMany({ where: { companyId: DEMO_COMPANY_ID } });

  const branches = await prisma.branch.findMany({ where: { companyId: DEMO_COMPANY_ID } });
  const branchIds = branches.map((b) => b.id);

  await prisma.cashMovement.deleteMany({ where: { cashRegister: { branchId: { in: branchIds } } } });
  await prisma.cashRegister.deleteMany({ where: { branchId: { in: branchIds } } });
  await prisma.inventoryMovement.deleteMany({ where: { branchId: { in: branchIds } } });

  await prisma.productModifierOption.deleteMany({ where: { group: { product: { companyId: DEMO_COMPANY_ID } } } });
  await prisma.productModifierGroup.deleteMany({ where: { product: { companyId: DEMO_COMPANY_ID } } });
  await prisma.product.deleteMany({ where: { companyId: DEMO_COMPANY_ID } });
  await prisma.category.deleteMany({ where: { companyId: DEMO_COMPANY_ID } });

  console.log("Datos transaccionales y catálogo anterior eliminados.");

  // Recrea un catálogo limpio, igual al original del seed.
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
      data: { companyId: DEMO_COMPANY_ID, name: cat.name, sortOrder: i },
    });
    for (const p of cat.products) {
      await prisma.product.create({
        data: {
          companyId: DEMO_COMPANY_ID,
          categoryId: category.id,
          name: p.name,
          price: p.price,
          taxRate: 0,
          isActive: true,
        },
      });
    }
  }

  console.log("Catálogo limpio recreado (8 productos, 3 categorías).");
  console.log("Listo. Los usuarios de Taquería Demo NO se tocaron — mismas credenciales de siempre.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });