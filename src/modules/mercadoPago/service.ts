import { prisma } from "@/lib/prisma";
import { encodeExternalReference, decodeExternalReference } from "./externalReference";

const MP_API = "https://api.mercadopago.com";
const MP_AUTH = "https://auth.mercadopago.com/authorization";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta configurar ${name} en las variables de entorno`);
  return value;
}

/**
 * OAuth Connect: cada restaurante conecta SU PROPIA cuenta de Mercado Pago.
 * Tappy nunca ve/toca el dinero — solo genera el cobro con el token del
 * restaurante, así que el dinero cae directo en su cuenta (sección de
 * "Mercado Pago Marketplace decisions" — cero comisión extra de Tappy).
 */
export function getAuthorizeUrl(companyId: string): string {
  const clientId = requireEnv("MERCADOPAGO_CLIENT_ID");
  const redirectUri = requireEnv("MERCADOPAGO_REDIRECT_URI");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    state: companyId, // el callback confía en esto porque solo el link que nosotros generamos lo trae
    redirect_uri: redirectUri,
  });

  return `${MP_AUTH}?${params.toString()}`;
}

interface MpTokenResponse {
  access_token: string;
  refresh_token: string;
  user_id: number;
  public_key: string;
  live_mode: boolean;
  expires_in: number; // segundos
}

export const mercadoPagoService = {
  async exchangeCodeForToken(code: string): Promise<MpTokenResponse> {
    const res = await fetch(`${MP_API}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: requireEnv("MERCADOPAGO_CLIENT_ID"),
        client_secret: requireEnv("MERCADOPAGO_CLIENT_SECRET"),
        grant_type: "authorization_code",
        code,
        redirect_uri: requireEnv("MERCADOPAGO_REDIRECT_URI"),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Mercado Pago rechazó el código de autorización: ${body}`);
    }

    return res.json();
  },

  async saveAccount(companyId: string, token: MpTokenResponse) {
    const expiresAt = new Date(Date.now() + token.expires_in * 1000);
    return prisma.mercadoPagoAccount.upsert({
      where: { companyId },
      update: {
        mpUserId: String(token.user_id),
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        publicKey: token.public_key,
        liveMode: token.live_mode,
        expiresAt,
      },
      create: {
        companyId,
        mpUserId: String(token.user_id),
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        publicKey: token.public_key,
        liveMode: token.live_mode,
        expiresAt,
      },
    });
  },

  async getAccount(companyId: string) {
    return prisma.mercadoPagoAccount.findUnique({ where: { companyId } });
  },

  async disconnect(companyId: string) {
    await prisma.mercadoPagoAccount.deleteMany({ where: { companyId } });
  },

  /**
   * Devuelve un access_token vigente para la cuenta de la empresa,
   * refrescándolo primero si ya venció o está por vencer. Todo lo que
   * llame a la API de Mercado Pago a nombre del restaurante debe pasar
   * por aquí en vez de leer accessToken directo del modelo.
   */
  async getValidAccessToken(companyId: string): Promise<string> {
    const account = await prisma.mercadoPagoAccount.findUnique({ where: { companyId } });
    if (!account) throw new Error("Esta empresa no tiene una cuenta de Mercado Pago conectada");

    const expiresInFiveMinutes = account.expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
    if (!expiresInFiveMinutes) return account.accessToken;

    const res = await fetch(`${MP_API}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: requireEnv("MERCADOPAGO_CLIENT_ID"),
        client_secret: requireEnv("MERCADOPAGO_CLIENT_SECRET"),
        grant_type: "refresh_token",
        refresh_token: account.refreshToken,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`No se pudo refrescar el token de Mercado Pago: ${body}`);
    }

    const token: MpTokenResponse = await res.json();
    const updated = await this.saveAccount(companyId, token);
    return updated.accessToken;
  },

  /**
   * Crea una preferencia de Checkout Pro para una orden ya existente.
   * notification_url lleva el companyId en la query — así el webhook (que
   * llega sin ningún contexto de sesión) sabe de entrada de qué empresa es
   * el pago, antes incluso de tener que llamar a Mercado Pago.
   */
  async createPreferenceForOrder(companyId: string, order: {
    id: string;
    items: { product: { name: string }; quantity: number; unitPriceAtSale: unknown }[];
  }) {
    const accessToken = await this.getValidAccessToken(companyId);
    const baseUrl = requireEnv("MERCADOPAGO_REDIRECT_URI").replace("/api/mercadopago/oauth/callback", "");

    const externalReference = encodeExternalReference({ kind: "order", companyId, orderId: order.id });

    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        items: order.items.map((item) => ({
          title: item.product.name,
          quantity: item.quantity,
          unit_price: Number(item.unitPriceAtSale),
          currency_id: "MXN",
        })),
        external_reference: externalReference,
        notification_url: `${baseUrl}/api/mercadopago/webhook?companyId=${companyId}`,
        back_urls: {
          success: `${baseUrl}/pos`,
          failure: `${baseUrl}/pos`,
          pending: `${baseUrl}/pos`,
        },
        auto_return: "approved",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`No se pudo crear el cobro en Mercado Pago: ${body}`);
    }

    const preference = await res.json();

    await prisma.payment.updateMany({
      where: { orderId: order.id, method: "MERCADOPAGO" },
      data: { mpPreferenceId: preference.id },
    });

    return {
      preferenceId: preference.id as string,
      checkoutUrl: (preference.init_point ?? preference.sandbox_init_point) as string,
    };
  },

  /**
   * Procesa una notificación de webhook. companyId viene de la query del
   * notification_url (ver createPreferenceForOrder), NUNCA del body —
   * el body de Mercado Pago no trae de qué empresa es hasta que ya
   * consultamos el pago, y para consultarlo primero necesitamos saber
   * de qué empresa es el token a usar.
   */
  async handleWebhook(companyId: string, paymentId: string) {
    const accessToken = await this.getValidAccessToken(companyId);

    const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`No se pudo consultar el pago ${paymentId} en Mercado Pago`);
    }
    const payment = await res.json();

    const ref = payment.external_reference ? decodeExternalReference(payment.external_reference) : null;
    if (!ref || ref.kind !== "order" || ref.companyId !== companyId) {
      // No es un pago de una orden de POS de esta empresa (podría ser de
      // financiamiento de hardware u otra cosa) — no es error, solo no aplica aquí.
      return { handled: false as const };
    }

    const status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" =
      payment.status === "approved"
        ? "APPROVED"
        : payment.status === "rejected"
        ? "REJECTED"
        : payment.status === "cancelled"
        ? "CANCELLED"
        : "PENDING";

    await prisma.payment.updateMany({
      where: { orderId: ref.orderId, method: "MERCADOPAGO" },
      data: { status, mpPaymentId: String(payment.id) },
    });

    if (status === "APPROVED") {
      const { salesService } = await import("@/modules/sales/service");
      await salesService.finalizeApprovedOrder(ref.orderId);
    } else if (status === "REJECTED" || status === "CANCELLED") {
      await prisma.order.updateMany({ where: { id: ref.orderId }, data: { status: "CANCELED" } });
    }

    return { handled: true as const, orderId: ref.orderId, status };
  },

  // ---------------------------------------------------------------------
  // MERCADO PAGO POINT — terminal física (Orders API, no la vieja Payment
  // Intent API que Mercado Pago está retirando).
  // ---------------------------------------------------------------------

  /** Terminales Point disponibles en la cuenta conectada de la empresa (para elegir cuál vincular a cada sucursal). */
  async listTerminals(companyId: string) {
    const accessToken = await this.getValidAccessToken(companyId);
    const res = await fetch(`${MP_API}/terminals/v1/list`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`No se pudo obtener la lista de terminales: ${body}`);
    }
    const data = await res.json();
    return data.data?.terminals ?? [];
  },

  /** Una terminal debe estar en modo PDV para poder recibir cobros por API — se activa al vincularla. */
  async setTerminalPdvMode(companyId: string, terminalId: string, posId: number) {
    const accessToken = await this.getValidAccessToken(companyId);
    const res = await fetch(`${MP_API}/terminals/v1/setup`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ terminal_id: terminalId, pos_id: posId, operating_mode: "PDV" }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`No se pudo activar el modo PDV en la terminal: ${body}`);
    }
  },

  /** Manda un cobro a una terminal física para una orden ya existente. */
  async createPointOrder(companyId: string, orderId: string, total: number, terminalId: string) {
    const accessToken = await this.getValidAccessToken(companyId);
    const externalReference = encodeExternalReference({ kind: "order", companyId, orderId });

    const res = await fetch(`${MP_API}/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        type: "point",
        external_reference: externalReference,
        transactions: { payments: [{ amount: total.toFixed(2) }] },
        config: { point: { terminal_id: terminalId, print_on_terminal: "no_ticket" } },
        description: `Tappy — orden ${orderId}`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`No se pudo mandar el cobro a la terminal: ${body}`);
    }

    const pointOrder = await res.json();

    await prisma.payment.updateMany({
      where: { orderId, method: "MERCADOPAGO_TERMINAL" },
      data: { mpPointOrderId: pointOrder.id },
    });

    return pointOrder as { id: string; status: string };
  },

  /** Consulta el estatus de un cobro mandado a terminal (para el polling desde el POS). */
  async getPointOrder(companyId: string, pointOrderId: string) {
    const accessToken = await this.getValidAccessToken(companyId);
    const res = await fetch(`${MP_API}/v1/orders/${pointOrderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`No se pudo consultar el cobro de la terminal: ${body}`);
    }
    return res.json();
  },

  async cancelPointOrder(companyId: string, pointOrderId: string) {
    const accessToken = await this.getValidAccessToken(companyId);
    await fetch(`${MP_API}/v1/orders/${pointOrderId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "X-Idempotency-Key": crypto.randomUUID() },
    });
  },
};
