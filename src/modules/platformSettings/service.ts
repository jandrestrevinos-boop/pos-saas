import { prisma } from "@/lib/prisma";

/**
 * Fila única de configuración de la plataforma. get() la crea con los
 * valores por defecto si todavía no existe (primer arranque).
 */
export const platformSettingsService = {
  async get() {
    const existing = await prisma.platformSettings.findFirst();
    if (existing) return existing;
    return prisma.platformSettings.create({ data: {} });
  },

  async update(data: { blockCancellationWithPendingFinancing?: boolean }) {
    const current = await platformSettingsService.get();
    return prisma.platformSettings.update({ where: { id: current.id }, data });
  },
};
