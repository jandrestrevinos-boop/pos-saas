import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { messageProcessor } from "@/modules/whatsapp/messageProcessor";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
    const message = value?.messages?.[0];

    // Meta también manda eventos de "status" (entregado/leído) sin
    // "messages" en el payload — los ignoramos, no son mensajes nuevos
    // de un cliente.
    if (phoneNumberId && message) {
      const from: string = message.from;
      const messageId: string = message.id;
      const text: string = message.text?.body ?? "";

      // Punto clave multi-tenant: identificamos la empresa dueña de este
      // número usando SOLO el phone_number_id que manda Meta — nunca
      // confiamos en nada que venga del lado del cliente.
      const config = await prisma.whatsAppConfig.findFirst({
        where: { phoneNumberId, isEnabled: true },
      });

      if (!config) {
        console.warn(
          `[WhatsApp Webhook] No hay configuración activa para phoneNumberId=${phoneNumberId}`
        );
      } else {
        const branchId =
          config.branchId ??
          (await prisma.branch.findFirst({ where: { companyId: config.companyId } }))?.id;

        if (!branchId) {
          console.error(
            `[WhatsApp Webhook] La empresa ${config.companyId} no tiene ninguna sucursal configurada`
          );
        } else if (text) {
          await messageProcessor.processMessage({
            phoneNumber: from,
            companyId: config.companyId,
            branchId,
            messageText: text,
            messageId,
            whatsappPhoneNumberId: config.phoneNumberId,
            whatsappAccessToken: config.accessToken,
          });
        }
      }
    }
  } catch (error) {
    console.error("Error procesando webhook de WhatsApp:", error);
    // Siempre respondemos 200 aunque haya un error interno — si le
    // mandamos un error a Meta, reintenta el mismo webhook varias veces
    // y puede terminar duplicando mensajes.
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
