/**
 * sender.ts
 * Envía mensajes a WhatsApp via Meta Cloud API
 */

interface SendMessageParams {
  phoneNumber: string;
  message: string;
  companyId?: string;
}

export const sender = {
  async sendMessage(params: SendMessageParams): Promise<boolean> {
    try {
      const { phoneNumber, message } = params;

      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

      if (!phoneNumberId || !accessToken) {
        console.error("[WhatsApp Sender] Credenciales faltantes");
        return false;
      }

      const cleanNumber = phoneNumber.replace(/\D/g, "");

      const response = await fetch(
        `https://graph.instagram.com/v18.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
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
    status: "PREPARING" | "READY" | "DELIVERED" | "CANCELLED"
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
    });
  },
};
