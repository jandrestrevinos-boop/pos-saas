/**
 * sender.ts
 * Envía mensajes a WhatsApp via Meta Cloud API.
 * Multi-tenant: las credenciales (phoneNumberId/accessToken) se reciben
 * como parámetro — cada restaurante manda desde su propio número, nunca
 * desde una cuenta compartida de Jose.
 */

interface SendMessageParams {
  phoneNumber: string;
  message: string;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
}

export const sender = {
  async sendMessage(params: SendMessageParams): Promise<boolean> {
    try {
      const { phoneNumber, message, whatsappPhoneNumberId, whatsappAccessToken } = params;

      if (!whatsappPhoneNumberId || !whatsappAccessToken) {
        console.error("[WhatsApp Sender] Credenciales faltantes para esta empresa");
        return false;
      }

      const cleanNumber = phoneNumber.replace(/\D/g, "");

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${whatsappPhoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${whatsappAccessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanNumber,
            type: "text",
            text: {
              preview_url: false,
              body: message,
            },
          }),
        }
      );

      const data = (await response.json()) as any;

      if (!response.ok || data.error) {
        console.error("[WhatsApp Sender] Error:", data.error?.message);
        return false;
      }

      return !!data.messages?.[0]?.id;
    } catch (error) {
      console.error("[WhatsApp Sender] Error:", error);
      return false;
    }
  },

  async sendOrderStatusUpdate(
    phoneNumber: string,
    ticketNumber: string,
    status: "PREPARING" | "READY" | "DELIVERED" | "CANCELLED",
    whatsappPhoneNumberId: string,
    whatsappAccessToken: string
  ): Promise<boolean> {
    const messages: Record<typeof status, string> = {
      PREPARING: `⏱️ Tu orden #${ticketNumber} está siendo preparada.`,
      READY: `✅ ¡Tu orden #${ticketNumber} está lista!`,
      DELIVERED: `🎉 ¡Gracias por tu compra!`,
      CANCELLED: `❌ Orden #${ticketNumber} cancelada.`,
    };

    return this.sendMessage({
      phoneNumber,
      message: messages[status],
      whatsappPhoneNumberId,
      whatsappAccessToken,
    });
  },
};
