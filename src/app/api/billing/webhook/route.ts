import { NextResponse } from "next/server";
import { billingService } from "@/modules/billing/service";

/**
 * Webhook de Mercado Pago para la cuenta de JOSE (suscripciones de TAPI).
 * Distinto de /api/mercadopago/webhook, que es de las cuentas de cada restaurante.
 *
 * Configurar en el panel de desarrolladores de Mercado Pago (tu aplicación →
 * Webhooks), en producción, con los eventos "Planes y suscripciones":
 *   URL: https://www.tappysoftware.com/api/billing/webhook
 *
 * Mercado Pago reintenta si no respondemos 200, así que siempre respondemos 200
 * (los errores quedan en logs). Nada del body se considera confiable: solo
 * tomamos el id y consultamos a Mercado Pago con nuestro token.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // a veces el aviso viene solo por querystring
  }

  const topic = (body.type as string | undefined) ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const resourceId =
    ((body.data as { id?: string } | undefined)?.id as string | undefined) ??
    url.searchParams.get("data.id") ??
    url.searchParams.get("id") ??
    undefined;

  if (!topic || !resourceId) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const result = await billingService.handleNotification(topic, String(resourceId));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Error procesando webhook de cobro de suscripción:", err);
    return NextResponse.json({ ok: true, error: "internal" });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
