import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const branchSchema = z.object({
  name: z.string().trim().min(2, "El nombre de la sucursal es obligatorio").max(80),
  address: z.string().trim().max(200).optional(),
});

export const branchUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  address: z.string().trim().max(200).nullable().optional(),
  isActive: z.boolean().optional(),
});

/** Cuántas sucursales activas puede tener la empresa según su licencia (null = sin licencia registrada). */
async function getBranchLimit(companyId: string): Promise<number | null> {
  const sub = await prisma.subscription.findUnique({ where: { companyId }, include: { license: true } });
  return sub?.license?.allowedBranches ?? null;
}

export const branchesService = {
  async list(companyId: string) {
    return prisma.branch.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { users: true } } },
    });
  },

  async overview(companyId: string) {
    const [branches, limit] = await Promise.all([this.list(companyId), getBranchLimit(companyId)]);
    const activeCount = branches.filter((b) => b.isActive).length;
    return { branches, limit, activeCount };
  },

  async create(companyId: string, userId: string, input: z.infer<typeof branchSchema>) {
    const limit = await getBranchLimit(companyId);
    if (limit !== null) {
      const activeCount = await prisma.branch.count({ where: { companyId, isActive: true } });
      if (activeCount >= limit) {
        throw new Error(
          limit === 1
            ? "Tu plan incluye 1 sucursal. Para operar más sucursales necesitas el plan Empresarial."
            : `Tu plan incluye hasta ${limit} sucursales y ya las tienes todas. Desactiva una o contacta a Tappy para ampliar tu plan.`
        );
      }
    }

    const duplicate = await prisma.branch.findFirst({
      where: { companyId, name: { equals: input.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) throw new Error("Ya tienes una sucursal con ese nombre");

    const branch = await prisma.branch.create({
      data: { companyId, name: input.name, address: input.address || null },
    });

    await prisma.auditLog.create({
      data: { companyId, userId, action: "BRANCH_CREATE", entity: "Branch", entityId: branch.id, newData: { name: branch.name } },
    });
    return branch;
  },

  async update(companyId: string, userId: string, id: string, input: z.infer<typeof branchUpdateSchema>) {
    const branch = await prisma.branch.findFirst({ where: { id, companyId } });
    if (!branch) throw new Error("Sucursal no encontrada");

    if (input.isActive === false && branch.isActive) {
      const activeCount = await prisma.branch.count({ where: { companyId, isActive: true } });
      if (activeCount <= 1) throw new Error("No puedes desactivar tu única sucursal activa");

      const openRegisters = await prisma.cashRegister.count({ where: { branchId: id, status: "OPEN" } });
      if (openRegisters > 0) throw new Error("Esta sucursal tiene una caja abierta. Haz el corte de caja antes de desactivarla.");
    }

    if (input.isActive === true && !branch.isActive) {
      const limit = await getBranchLimit(companyId);
      if (limit !== null) {
        const activeCount = await prisma.branch.count({ where: { companyId, isActive: true } });
        if (activeCount >= limit) throw new Error(`Tu plan incluye hasta ${limit} sucursales activas.`);
      }
    }

    if (input.name && input.name.toLowerCase() !== branch.name.toLowerCase()) {
      const duplicate = await prisma.branch.findFirst({
        where: { companyId, id: { not: id }, name: { equals: input.name, mode: "insensitive" } },
        select: { id: true },
      });
      if (duplicate) throw new Error("Ya tienes una sucursal con ese nombre");
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.address !== undefined ? { address: input.address || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "BRANCH_UPDATE",
        entity: "Branch",
        entityId: id,
        previousData: { name: branch.name, address: branch.address, isActive: branch.isActive },
        newData: { name: updated.name, address: updated.address, isActive: updated.isActive },
      },
    });
    return updated;
  },
};
