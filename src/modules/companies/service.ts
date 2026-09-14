import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { hardwareFinancingService } from "@/modules/hardwareFinancing/service";
import { platformSettingsService } from "@/modules/platformSettings/service";

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
    const company = await prisma.company.update({ where: { id }, data: { status } });

    // Regla #10 de la spec de financiamiento: suspender/cancelar la
    // empresa en TAPI NUNCA debe borrar ni alterar un financiamiento de
    // hardware con saldo pendiente. Este es el punto de enganche más
    // cercano hoy (no existe todavía un endpoint dedicado de "cancelar
    // suscripción" — solo este de suspender empresa); si más adelante se
    // agrega cancelación real de Subscription, replicar esta misma llamada ahí.
    if (status === "SUSPENDED") {
      await hardwareFinancingService.logNoEffectEvent(id, "SUBSCRIPTION_CANCELLED_NO_EFFECT", {
        companyStatus: status,
      });
    }

    return company;
  },

  /**
   * Cancelación real de la suscripción de TAPI (sección 10 de la spec,
   * actualizada por Jose): cancelación de software y financiamiento de
   * hardware quedan DEPENDIENTES — una empresa no puede cancelar mientras
   * tenga saldo de hardware pendiente, salvo que la política comercial
   * (PlatformSettings) lo permita explícitamente.
   *
   * En cualquier caso, si la cancelación procede, el saldo pendiente, el
   * calendario de pagos, los pagos realizados y los pendientes de
   * HardwareFinancing se conservan intactos — esto solo cancela
   * Subscription/Company, nunca toca HardwareFinancing directamente.
   */
  async cancelSubscription(companyId: string) {
    const settings = await platformSettingsService.get();

    if (settings.blockCancellationWithPendingFinancing) {
      const pending = await hardwareFinancingService.getPendingFinancings(companyId);
      if (pending.length > 0) {
        const detail = pending
          .map((f) => `${f.code} (saldo $${Number(f.remainingBalance).toFixed(2)}, ${f.paymentsCompleted}/${f.totalInstallments} pagos)`)
          .join(", ");
        throw new Error(
          `No se puede cancelar: esta empresa tiene financiamiento de hardware pendiente — ${detail}. Debe liquidarse antes de cancelar la suscripción.`
        );
      }
    }

    const subscription = await prisma.subscription.findUnique({ where: { companyId } });
    if (subscription) {
      await prisma.subscription.update({ where: { companyId }, data: { status: "CANCELED" } });
    }

    const company = await prisma.company.update({ where: { id: companyId }, data: { status: "CANCELLED" } });

    await hardwareFinancingService.logNoEffectEvent(companyId, "SUBSCRIPTION_CANCELLED_NO_EFFECT", {
      policyBlocked: settings.blockCancellationWithPendingFinancing,
    });

    return company;
  },

  async changePlan(
    companyId: string,
    planId: string,
    customization?: { useCustomPlan: boolean; customPriceMxn?: number | null; customFeatures?: string[] }
  ) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error("El plan seleccionado no existe");

    const subscription = await prisma.subscription.findUnique({ where: { companyId }, include: { license: true } });
    if (!subscription) throw new Error("Esta empresa no tiene una suscripción activa");

    // Si el plan nuevo tiene límites menores, avisamos en vez de degradar en
    // silencio — por ejemplo, no queremos que usuarios existentes queden en
    // un estado ambiguo si ya rebasan el nuevo límite. Los límites de
    // capacidad (sucursales/usuarios/cajas) siempre vienen del plan base,
    // incluso si la empresa tiene precio/features personalizados.
    const currentUserCount = await prisma.user.count({ where: { companyId } });
    if (currentUserCount > plan.maxUsers) {
      throw new Error(
        `Esta empresa ya tiene ${currentUserCount} usuarios, más de los ${plan.maxUsers} permitidos en ${plan.name}. Desactiva usuarios antes de bajar de plan.`
      );
    }

    const useCustomPlan = customization?.useCustomPlan ?? false;

    await prisma.subscription.update({
      where: { companyId },
      data: {
        planId,
        useCustomPlan,
        customPriceMxn: useCustomPlan ? customization?.customPriceMxn ?? null : null,
        customFeatures: useCustomPlan ? customization?.customFeatures ?? [] : [],
      },
    });

    if (useCustomPlan) {
      await prisma.auditLog.create({
        data: {
          companyId,
          action: "PLAN_CUSTOMIZED",
          entity: "Subscription",
          entityId: subscription.id,
          newData: {
            basePlanId: planId,
            customPriceMxn: customization?.customPriceMxn ?? null,
            customFeatures: customization?.customFeatures ?? [],
          },
        },
      });
    }

    // Regla #9 de la spec de financiamiento: un cambio de plan de software
    // NUNCA debe tocar un financiamiento de hardware activo. No hace falta
    // ningún ajuste aquí — HardwareFinancing vive en tablas separadas —
    // solo dejamos constancia en auditoría para quien revise el historial.
    await hardwareFinancingService.logNoEffectEvent(companyId, "PLAN_CHANGED_NO_EFFECT", {
      fromPlanId: subscription.planId,
      toPlanId: planId,
    });

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
