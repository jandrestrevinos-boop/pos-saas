import { prisma } from "@/lib/prisma";
import { VALID_FEATURE_KEYS } from "@/lib/plan-features";

/**
 * Punto único de verdad para "¿esta empresa tiene esta feature de plan?".
 * Mismo patrón que hasPermission()/PERMISSIONS en src/lib/permissions.ts,
 * pero para features de plan en vez de permisos de rol.
 *
 * Resolución:
 *  - Si la empresa tiene useCustomPlan=true en su Subscription, se usa
 *    Subscription.customFeatures (negociado por empresa).
 *  - Si no, se usa Plan.features del plan base contratado.
 *  - SUPER_ADMIN nunca pasa por aquí (no tiene companyId).
 *
 * No cachea entre requests a propósito: un cambio de plan/feature desde
 * /plataforma debe reflejarse de inmediato en el siguiente request del
 * tenant, sin esperar a que expire un cache.
 */
export async function getEffectiveFeatureKeys(companyId: string): Promise<Set<string>> {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId },
    include: { plan: true },
  });

  if (!subscription) return new Set();

  const raw = subscription.useCustomPlan
    ? subscription.customFeatures
    : ((subscription.plan.features as string[] | null) ?? []);

  // Filtra cualquier valor que no sea una key válida del catálogo actual
  // (por ejemplo, labels viejos en español que no se hayan migrado, o
  // features que se hayan retirado del catálogo).
  return new Set(raw.filter((key: string) => VALID_FEATURE_KEYS.has(key)));
}

export async function hasFeature(companyId: string, featureKey: string): Promise<boolean> {
  const keys = await getEffectiveFeatureKeys(companyId);
  return keys.has(featureKey);
}
