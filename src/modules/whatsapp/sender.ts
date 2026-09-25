/**
 * sender.ts
 * Envía mensajes a WhatsApp via Meta Cloud API.
 * Multi-tenant: las credenciales (phoneNumberId/accessToken) se reciben
 * como parámetro — cada restaurante manda desde su propio número, nunca
 * desde una cuenta compartida de Jose.
 */

/**
 * Meta reporta los números mexicanos con un "1" extra después del código
 * de país al recibir un mensaje (52 + 1 + 10 dígitos = 13 dígitos), pero
 * ese mismo formato es RECHAZADO al enviar — hay que quitar ese "1" antes
 * de mandar (52 + 10 dígitos = 12 dígitos). Confirmado a mano con curl:
 * "528123557288" (sin el 1) → 200 OK; "5218123557288" (con el 1) → 400
 * "(#131030) Recipient phone number not in allowed list".
 * Este bug es específico de México — otros países no llevan ese dígito
 * extra, así que solo tocamos números que empiecen con "521" y tengan
 * exactamente 13 dígitos.
 */
function cleanMexicanNumber(phoneNumber: string): string {
  const digitsOnly = phoneNumber.replace(/\D/g, "");
  if (digitsOnly.startsWith("521") && digitsOnly.length === 13) {
    return "52" + digitsOnly.slice(3);
  }
  return digitsOnly;
}

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

      const cleanNumber = cleanMexicanNumber(phoneNumber);

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
