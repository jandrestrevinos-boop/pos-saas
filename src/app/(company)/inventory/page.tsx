import { InventoryClient } from "./inventory-client";

export default function InventoryPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Inventario</h1>
      <p className="text-muted text-sm mb-8">Existencias y movimientos de los productos que controlas.</p>
      <InventoryClient />
    </div>
  );
}
