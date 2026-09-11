import { NextRequest, NextResponse } from "next/server";
import { messageProcessor } from "@/modules/whatsapp";

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
  try {
    const body = await req.json();

    console.log("✅ Webhook POST - Mensaje recibido:", JSON.stringify(body, null, 2));

    if (body.entry && body.entry[0]?.changes) {
      const changes = body.entry[0].changes[0];

      if (changes.value?.messages && changes.value.messages[0]) {
        const message = changes.value.messages[0];
        const phoneNumber = message.from;
        const messageText = message.text?.body || "";
        const messageId = message.id;

        const companyId = "db8890ab-7901-4842-bdc7-324cee7b98e0";
        const branchId = "c4c89b88-9907-49b1-b5ce-8cf9c4d1eb4f";

        await messageProcessor.processMessage({
          phoneNumber,
          companyId,
          branchId,
          messageText,
          messageId,
        });
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
