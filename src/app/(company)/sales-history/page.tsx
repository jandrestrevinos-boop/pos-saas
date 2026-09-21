import { SalesHistoryClient } from "./sales-history-client";

export default function SalesHistoryPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Historial de ventas</h1>
      <p className="text-muted text-sm mb-8">
        Cada venta aparece aquí en cuanto se cobra — la lista se actualiza sola cada 5 segundos.
      </p>
      <SalesHistoryClient />
    </div>
  );
}
