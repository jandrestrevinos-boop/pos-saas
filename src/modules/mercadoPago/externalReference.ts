/**
 * Referencia externa inequívoca para Mercado Pago. Un solo formato para
 * todo lo que puede generar un pago en Tappy, con un "kind" al frente para
 * poder enrutar el webhook sin ambigüedad (sección 7 de la spec de
 * financiamiento, generalizado a cualquier cobro):
 *
 *   hwfin:{companyId}:{financingId}:{paymentNumber}   -> mensualidad de financiamiento de hardware
 *   order:{companyId}:{orderId}                        -> venta del restaurante a SU cliente (Checkout Pro)
 */
export type ExternalReference =
  | { kind: "hwfin"; companyId: string; financingId: string; paymentNumber: number }
  | { kind: "order"; companyId: string; orderId: string };

export function encodeExternalReference(ref: ExternalReference): string {
  if (ref.kind === "hwfin") {
    return `hwfin:${ref.companyId}:${ref.financingId}:${ref.paymentNumber}`;
  }
  return `order:${ref.companyId}:${ref.orderId}`;
}

export function decodeExternalReference(raw: string): ExternalReference | null {
  const parts = raw.split(":");

  if (parts[0] === "hwfin" && parts.length === 4) {
    const paymentNumber = parseInt(parts[3], 10);
    if (Number.isNaN(paymentNumber)) return null;
    return { kind: "hwfin", companyId: parts[1], financingId: parts[2], paymentNumber };
  }

  if (parts[0] === "order" && parts.length === 3) {
    return { kind: "order", companyId: parts[1], orderId: parts[2] };
  }

  return null;
}
