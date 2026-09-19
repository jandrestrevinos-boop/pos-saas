import { NextResponse } from "next/server";
import { mercadoPagoService } from "@/modules/mercadoPago/service";

/**
 * Mercado Pago llama aquí sin sesión (no es un usuario de Tappy). El
 * companyId viene en la query porque nosotros mismos lo pusimos ahí al
 * generar la preferencia (ver notification_url en createPreferenceForOrder)
 * — es la única forma de saber de qué restaurante es el aviso ANTES de
 * poder consultar el pago (para consultarlo ya se necesita el token de
 * ESE restaurante).
 *
 * Mercado Pago reintenta si no respondemos 200, así que cualquier cosa
 * que no podamos procesar responde 200 igual (después de loguearla) para
 * no generar reintentos infinitos por una notificación que nunca vamos a
 * poder resolver (ej. companyId inválido, o el tipo de evento no es "payment").
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId");

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Mercado Pago a veces manda la notificación por querystring en vez de body
  }

  const type = (body.type as string) ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const paymentId =
    ((body.data as { id?: string })?.id as string | undefined) ?? url.searchParams.get("data.id") ?? undefined;

  if (!companyId || type !== "payment" || !paymentId) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const result = await mercadoPagoService.handleWebhook(companyId, paymentId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Error procesando webhook de Mercado Pago:", err);
    // 200 de todos modos: si el error es nuestro (ej. token vencido y el
    // refresh también falló), reintentar con el mismo request no lo va a
    // arreglar solo; que quede en logs para revisarlo a mano.
    return NextResponse.json({ ok: true, error: "internal" });
  }
}

// Mercado Pago también puede notificar por GET en integraciones viejas
export async function GET(req: Request) {
  return POST(req);
}
