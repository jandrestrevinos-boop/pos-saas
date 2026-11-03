/**
 * Descuento de clientes frecuentes para un subtotal. Módulo puro (sin base de datos) para que
 * el servidor y las pantallas de Caja calculen exactamente lo mismo.
 * Las recompensas de tipo GIFT (producto de regalo) no descuentan nada: el regalo se agrega aparte.
 */
export type RewardType = "PERCENT" | "FIXED" | "GIFT";

export function computeLoyaltyDiscount(type: RewardType, value: number, subtotal: number): number {
  if (type === "GIFT") return 0;
  const raw = type === "PERCENT" ? (subtotal * value) / 100 : value;
  return Math.round(Math.min(raw, subtotal) * 100) / 100;
}
