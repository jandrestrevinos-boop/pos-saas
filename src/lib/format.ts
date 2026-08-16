export function formatMxn(amount: number | string): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value) + " MXN";
}
