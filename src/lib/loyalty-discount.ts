/**
 * Descuento de clientes frecuentes para un subtotal. Módulo puro (sin base de datos) para que
 * el servidor y las pantallas de Caja calculen exactamente lo mismo.
 */
export function computeLoyaltyDiscount(type: "PERCENT" | "FIXED", value: number, subtotal: number): number {
  const raw = type === "PERCENT" ? (subtotal * value) / 100 : value;
  return Math.round(Math.min(raw, subtotal) * 100) / 100;
}
