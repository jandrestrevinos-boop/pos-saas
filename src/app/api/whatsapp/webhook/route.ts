import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  console.log("Webhook GET - Validando token de Meta");
  console.log("Token recibido:", token);
  console.log("Token esperado:", verifyToken);

  if (mode === "subscribe" && token === verifyToken) {
    console.log("✅ Webhook validado correctamente");
    return new NextResponse(challenge, { status: 200 });
  }

  console.log("❌ Token inválido o mode incorrecto");
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  console.log("Webhook POST - Mensaje recibido:", JSON.stringify(body, null, 2));

  // Por ahora, solo respondemos 200 OK
  // Después implementaremos la lógica completa

  return NextResponse.json({ received: true }, { status: 200 });
}