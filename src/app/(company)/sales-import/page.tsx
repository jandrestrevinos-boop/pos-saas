import { ImportSalesButton } from "@/components/import-sales-button";

export default function SalesImportPage() {
  return (
    <div className="p-6">
      <h1 className="font-display text-2xl mb-1">Importar historial de ventas</h1>
      <p className="text-sm text-muted mb-6">
        Trae las ventas de tu sistema anterior. No mueven inventario, caja ni cocina: solo alimentan reportes.
      </p>
      <ImportSalesButton />
    </div>
  );
}
