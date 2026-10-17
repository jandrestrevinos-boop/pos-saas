/**
 * Un menú completo consume inventario de lo que el cliente eligió además del propio menú:
 * si eligió "arroz" como guarnición, se descuenta una porción de arroz por cada menú vendido.
 * Esta función expande los renglones de una venta a la lista plana de productos a descontar
 * (o reponer, al cancelar). Los productos sin elecciones pasan tal cual.
 */
export interface InventoryLine {
  productId: string;
  quantity: number;
}

export function expandMenuInventory(
  items: { productId: string; quantity: number; menuChoices?: { optionProductId: string }[] | null }[]
): InventoryLine[] {
  const lines: InventoryLine[] = [];
  for (const item of items) {
    lines.push({ productId: item.productId, quantity: item.quantity });
    for (const choice of item.menuChoices ?? []) {
      lines.push({ productId: choice.optionProductId, quantity: item.quantity });
    }
  }
  return lines;
}
