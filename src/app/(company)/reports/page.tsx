import { ReportsClient } from "./reports-client";

export default function ReportsPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Reportes</h1>
      <p className="text-muted text-sm mb-8">Ventas por rango de fechas, producto y método de pago.</p>
      <ReportsClient />
    </div>
  );
}
