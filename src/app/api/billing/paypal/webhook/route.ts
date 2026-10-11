import { NextResponse } from "next/server";
import { paypalBilling, PaypalSignatureError } from "@/modules/billing/paypal";

/**
 * Webhook de PayPal para la cuenta de TAPPY (suscripciones de Tappy).
 *
 * Configurar en developer.paypal.com (tu app → Webhooks), con esta URL:
 *   https://www.tappysoftware.com/api/billing/paypal/webhook
 * y estos eventos:
 *   Payment sale completed
 *   Billing subscription activated / cancelled / suspended / expired
 *   Billing subscription payment failed
 *
 * La firma de cada aviso se verifica con PayPal (PAYPAL_WEBHOOK_ID).
 * Firma inválida → 400. Error interno → 500 para que PayPal reintente
 * (los pagos son idempotentes, un reintento no duplica nada).
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  try {
    const result = await paypalBilling.handleWebhook(req.headers, rawBody);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof PaypalSignatureError) {
      console.error("Webhook de PayPal con firma inválida");
      return NextResponse.json({ ok: false, error: "firma inválida" }, { status: 400 });
    }
    console.error("Error procesando webhook de PayPal:", err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
