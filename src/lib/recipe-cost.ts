/**
 * Cálculo puro del costo de una receta (sin base de datos), compartido por el servidor y la
 * pantalla de recetas para que el costo que se ve es el mismo que se guarda.
 *
 * Merma: si un insumo pierde 10% al limpiarlo/cocinarlo, para tener 1 kg utilizable hay que comprar
 * 1 / 0.9 kg, así que el costo efectivo por unidad sube a costPerUnit / (1 - merma).
 */
export const INGREDIENT_UNITS = ["kg", "g", "l", "ml", "pza"] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

export function effectiveUnitCost(costPerUnit: number, wastePercent: number): number {
  const waste = Math.min(Math.max(wastePercent, 0), 95); // tope para no dividir entre ~0
  return costPerUnit / (1 - waste / 100);
}

export interface RecipeLine {
  quantity: number;
  costPerUnit: number;
  wastePercent: number;
}

export function recipeCost(lines: RecipeLine[]): number {
  const total = lines.reduce((sum, l) => sum + l.quantity * effectiveUnitCost(l.costPerUnit, l.wastePercent), 0);
  return Math.round(total * 100) / 100;
}

/** Food Cost % = costo / precio de venta. null si no hay precio válido. */
export function foodCostPercent(cost: number, price: number): number | null {
  if (!(price > 0)) return null;
  return (cost / price) * 100;
}
