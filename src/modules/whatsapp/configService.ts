import { prisma } from "@/lib/prisma";

export const configService = {
  async getConfig(companyId: string) {
    return prisma.whatsAppConfig.findFirst({ where: { companyId } });
  },

  /**
   * Crea o actualiza el WhatsAppConfig de una empresa. accessToken es
   * opcional al actualizar (si el restaurante no lo vuelve a pegar, se
   * conserva el que ya tenía) — pero es obligatorio la primera vez
   * (validado en la API route antes de llamar aquí).
   */
  async upsertConfig(
    companyId: string,
    data: { phoneNumberId: string; accessToken?: string; welcomeMessage?: string }
  ) {
    const existing = await prisma.whatsAppConfig.findFirst({ where: { companyId } });

    if (existing) {
      return prisma.whatsAppConfig.update({
        where: { id: existing.id },
        data: {
          phoneNumberId: data.phoneNumberId,
          accessToken: data.accessToken ?? existing.accessToken,
          welcomeMessage: data.welcomeMessage ?? existing.welcomeMessage,
          isEnabled: true,
        },
      });
    }

    return prisma.whatsAppConfig.create({
      data: {
        companyId,
        phoneNumberId: data.phoneNumberId,
        accessToken: data.accessToken!,
        welcomeMessage: data.welcomeMessage ?? "Hola! Bienvenido a nuestro restaurante",
        isEnabled: true,
      },
    });
  },

  /** No borra el registro (conserva historial/credenciales) — solo lo apaga. */
  async disconnect(companyId: string) {
    const existing = await prisma.whatsAppConfig.findFirst({ where: { companyId } });
    if (!existing) return null;
    return prisma.whatsAppConfig.update({
      where: { id: existing.id },
      data: { isEnabled: false },
    });
  },
};
