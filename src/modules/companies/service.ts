import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  planId: z.string().min(1, "Selecciona un plan"),
  branchName: z.string().min(1, "El nombre de la primera sucursal es obligatorio"),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const companiesService = {
  async list() {
    return prisma.company.findMany({
      include: {
        branches: { select: { id: true } },
        users: { select: { id: true } },
        subscription: { include: { plan: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(input: CreateCompanyInput) {
    const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new Error("El plan seleccionado no existe");

    return prisma.company.create({
      data: {
        name: input.name,
        legalName: input.legalName,
        taxId: input.taxId,
        status: "ACTIVE",
        branches: { create: { name: input.branchName } },
        subscription: {
          create: {
            planId: plan.id,
            status: "TRIALING",
            license: {
              create: {
                allowedBranches: plan.maxBranches,
                allowedUsers: plan.maxUsers,
                allowedCashRegisters: plan.maxCashRegisters,
              },
            },
          },
        },
      },
    });
  },

  async setStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
    return prisma.company.update({ where: { id }, data: { status } });
  },

  async changePlan(companyId: string, planId: string) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error("El plan seleccionado no existe");

    const subscription = await prisma.subscription.findUnique({ where: { companyId }, include: { license: true } });
    if (!subscription) throw new Error("Esta empresa no tiene una suscripción activa");

    // Si el plan nuevo tiene límites menores, avisamos en vez de degradar en
    // silencio — por ejemplo, no queremos que usuarios existentes queden en
    // un estado ambiguo si ya rebasan el nuevo límite.
    const currentUserCount = await prisma.user.count({ where: { companyId } });
    if (currentUserCount > plan.maxUsers) {
      throw new Error(
        `Esta empresa ya tiene ${currentUserCount} usuarios, más de los ${plan.maxUsers} permitidos en ${plan.name}. Desactiva usuarios antes de bajar de plan.`
      );
    }

    await prisma.subscription.update({ where: { companyId }, data: { planId } });

    if (subscription.license) {
      await prisma.license.update({
        where: { id: subscription.license.id },
        data: {
          allowedBranches: plan.maxBranches,
          allowedUsers: plan.maxUsers,
          allowedCashRegisters: plan.maxCashRegisters,
        },
      });
    }

    return prisma.company.findUnique({
      where: { id: companyId },
      include: { subscription: { include: { plan: true, license: true } } },
    });
  },
};
