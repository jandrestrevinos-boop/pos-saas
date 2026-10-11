import { prisma } from "@/lib/prisma";
import { billingService, effectivePriceMxn } from "@/modules/billing/service";

/**
 * Cobro mensual de la suscripción de TAPI con PayPal Subscriptions.
 * El dinero entra a la cuenta PayPal Business de Tappy. Convive con Mercado
 * Pago (modules/billing/service.ts): cada empresa elige con cuál pagar.
 *
 * Flujo: createCheckout crea un plan + suscripción en PayPal y devuelve el
 * link donde el cliente la aprueba. PayPal avisa por webhook
 * (/api/billing/paypal/webhook); cada aviso se VERIFICA con la firma de PayPal
 * y los pagos son idempotentes por paypalPaymentId.
 *
 * Variables de entorno:
 *   PAYPAL_ENV            "sandbox" (pruebas) o "live" (real)
 *   PAYPAL_CLIENT_ID      Client ID de la app de PayPal
 *   PAYPAL_CLIENT_SECRET  Secret de la app de PayPal
 *   PAYPAL_WEBHOOK_ID     ID del webhook registrado en la app
 *   PAYPAL_PRODUCT_ID     (opcional) producto de PayPal reutilizable
 */

const PAYPAL_API = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

export class PaypalSignatureError extends Error {}

function appBaseUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const redirect = process.env.MERCADOPAGO_REDIRECT_URI;
  if (redirect) return redirect.replace("/api/mercadopago/oauth/callback", "").replace(/\/$/, "");
  throw new Error("Falta configurar APP_URL (ej. https://www.tappysoftware.com) en las variables de entorno");
}

async function accessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Falta configurar PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en las variables de entorno");
  }
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal respondió ${res.status} al autenticar: ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function ppFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${PAYPAL_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`PayPal respondió ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

interface PpLink {
  href: string;
  rel: string;
}

interface PpSubscription {
  id: string;
  status: string; // APPROVAL_PENDING | APPROVED | ACTIVE | SUSPENDED | CANCELLED | EXPIRED
  links?: PpLink[];
}

interface PpResource {
  id?: string;
  billing_agreement_id?: string;
  amount?: { total?: string; currency?: string };
}

interface PpWebhookEvent {
  id?: string;
  event_type: string;
  resource?: PpResource;
}

/** Producto de PayPal al que cuelgan los planes. Si no hay PAYPAL_PRODUCT_ID, se crea uno. */
async function ensureProductId(): Promise<string> {
  const existing = process.env.PAYPAL_PRODUCT_ID;
  if (existing) return existing;
  const product = await ppFetch<{ id: string }>("/v1/catalogs/products", {
    method: "POST",
    body: JSON.stringify({
      name: "Tappy - suscripcion de software",
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });
  console.log("[paypal] producto creado. Guarda esto en Vercel como PAYPAL_PRODUCT_ID:", product.id);
  return product.id;
}

async function verifySignature(headers: Headers, event: PpWebhookEvent) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    throw new Error("Falta configurar PAYPAL_WEBHOOK_ID en las variables de entorno");
  }
  const result = await ppFetch<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  if (result.verification_status !== "SUCCESS") {
    throw new PaypalSignatureError("Firma de webhook de PayPal inválida");
  }
}

export const paypalBilling = {
  /**
   * Crea el plan y la suscripción en PayPal y devuelve el link donde el
   * cliente la aprueba. Si todavía está en demo, el primer cobro se programa
   * para el día que termina el demo (start_time).
   */
  async createCheckout(companyId: string, userId: string) {
    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true, company: true },
    });
    if (!sub) throw new Error("Esta empresa no tiene una suscripción registrada");
    if (sub.company.status !== "ACTIVE") {
      throw new Error("Tu cuenta está suspendida. Contacta a soporte de Tappy.");
    }

    const price = effectivePriceMxn(sub);
    if (!(price > 0)) {
      throw new Error("Tu plan no tiene un precio mensual configurado. Contacta a soporte de Tappy.");
    }

    if (sub.paypalSubscriptionId) {
      const existing = await ppFetch<PpSubscription>(`/v1/billing/subscriptions/${sub.paypalSubscriptionId}`).catch(() => null);
      if (existing?.status === "ACTIVE") {
        throw new Error("Ya tienes un cobro automático activo con PayPal. Si necesitas cambiarlo, contacta a soporte de Tappy.");
      }
    }

    // Fecha del primer cobro: fin del demo (o del periodo ya pagado) si todavía está en el futuro.
    const now = new Date();
    const firstChargeAt = sub.status === "TRIALING" ? sub.trialEndsAt : sub.renewalDate;
    const startDate = firstChargeAt && firstChargeAt.getTime() > now.getTime() + 60 * 60 * 1000 ? firstChargeAt : null;

    const productId = await ensureProductId();

    const plan = await ppFetch<{ id: string }>("/v1/billing/plans", {
      method: "POST",
      body: JSON.stringify({
        product_id: productId,
        name: `Tappy ${sub.plan.name} - ${sub.company.name}`.slice(0, 120),
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: { interval_unit: "MONTH", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: { fixed_price: { value: price.toFixed(2), currency_code: "MXN" } },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      }),
    });

    const created = await ppFetch<PpSubscription>("/v1/billing/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: plan.id,
        ...(startDate ? { start_time: startDate.toISOString().replace(/\.\d{3}Z$/, "Z") } : {}),
        custom_id: `tappysub:${companyId}`,
        application_context: {
          brand_name: "Tappy",
          locale: "es-MX",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${appBaseUrl()}/facturacion?retorno=1`,
          cancel_url: `${appBaseUrl()}/facturacion`,
        },
      }),
    });
    console.log("[paypal-checkout]", JSON.stringify({ id: created.id, status: created.status, amount: price, startDate: startDate ? startDate.toISOString() : null }));

    const approveUrl = created.links?.find((l) => l.rel === "approve")?.href;
    if (!approveUrl) {
      throw new Error("PayPal no devolvió el link de pago");
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { paypalSubscriptionId: created.id },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "SUBSCRIPTION_CHECKOUT_CREATED",
        entity: "Subscription",
        entityId: sub.id,
        newData: {
          provider: "paypal",
          paypalSubscriptionId: created.id,
          amountMxn: price,
          firstChargeAt: startDate ? startDate.toISOString() : null,
        },
      },
    });

    return { checkoutUrl: approveUrl };
  },

  /**
   * Punto de entrada del webhook. Se verifica la firma con PayPal antes de
   * hacer nada; el aviso nunca se toma por bueno sin esa verificación.
   */
  async handleWebhook(headers: Headers, rawBody: string) {
    let event: PpWebhookEvent;
    try {
      event = JSON.parse(rawBody) as PpWebhookEvent;
    } catch {
      return { skipped: true as const, reason: "cuerpo inválido" };
    }

    await verifySignature(headers, event);

    const type = event.event_type;
    const resource = event.resource ?? {};
    console.log("[paypal-webhook]", type, JSON.stringify({ id: resource.id ?? null, billing_agreement_id: resource.billing_agreement_id ?? null }));

    if (type === "PAYMENT.SALE.COMPLETED") return this.processSale(resource);
    if (type === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") return this.processFailure(String(resource.id ?? ""));
    if (type.startsWith("BILLING.SUBSCRIPTION.")) return this.logSubscriptionEvent(type, String(resource.id ?? ""));
    return { skipped: true as const };
  },

  async processSale(resource: PpResource) {
    const subscriptionId = resource.billing_agreement_id;
    if (!subscriptionId || !resource.id) return { skipped: true as const, reason: "sin suscripción o sin id de pago" };

    const sub = await prisma.subscription.findUnique({
      where: { paypalSubscriptionId: subscriptionId },
      include: { plan: true },
    });
    if (!sub) return { skipped: true as const, reason: "suscripción desconocida" };

    const total = Number(resource.amount?.total);
    const amount = Number.isFinite(total) && total > 0 ? total : effectivePriceMxn(sub);

    return billingService.recordApprovedPayment({
      sub,
      amountMxn: amount,
      method: "PAYPAL",
      paypalPaymentId: String(resource.id),
      months: 1,
    });
  },

  async processFailure(subscriptionId: string) {
    const sub = await prisma.subscription.findUnique({ where: { paypalSubscriptionId: subscriptionId } });
    if (!sub) return { skipped: true as const, reason: "suscripción desconocida" };

    if (sub.status === "ACTIVE") {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAST_DUE" } });
    }
    await prisma.auditLog.create({
      data: {
        companyId: sub.companyId,
        action: "SUBSCRIPTION_PAYMENT_REJECTED",
        entity: "Subscription",
        entityId: sub.id,
        newData: { provider: "paypal", paypalSubscriptionId: subscriptionId },
      },
    });
    return { ok: true as const, rejected: true as const };
  },

  /** Activada, cancelada, suspendida o vencida: solo queda registrado. No corta el acceso (igual que Mercado Pago). */
  async logSubscriptionEvent(type: string, subscriptionId: string) {
    const sub = await prisma.subscription.findUnique({ where: { paypalSubscriptionId: subscriptionId } });
    if (!sub) return { skipped: true as const, reason: "suscripción desconocida" };

    await prisma.auditLog.create({
      data: {
        companyId: sub.companyId,
        action: `SUBSCRIPTION_PAYPAL_${type.split(".").pop() ?? "EVENT"}`,
        entity: "Subscription",
        entityId: sub.id,
        newData: { provider: "paypal", paypalSubscriptionId: subscriptionId, event: type },
      },
    });
    return { ok: true as const, event: type };
  },
};
