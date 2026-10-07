"use client";

import { useEffect, useState } from "react";
import { Card, StatCard } from "@/components/ui";
import { formatMxn } from "@/lib/format";

type Range = "today" | "7d" | "30d";
type Report = {
  summary: { timesApplied: number; totalDiscount: number; ordersWithPromo: number; ordersTotal: number };
  byPromotion: { name: string; timesApplied: number; totalDiscount: number }[];
  recent: { id: string; name: string; amount: number; createdAt: string; orderNumber: number; cashier: string | null }[];
};

const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
];

export function PromotionsReport() {
  const [range, setRange] = useState<Range>("today");
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    fetch(`/api/promotions/report?range=${range}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "No se pudo cargar el reporte");
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar el reporte"));
  }, [range]);

  const s = data?.summary;
  const pct = s && s.ordersTotal > 0 ? Math.round((s.ordersWithPromo / s.ordersTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Uso de promociones</p>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-md border px-3 py-1 text-xs ${range === r.key ? "bg-ink-950 text-white border-ink-950" : "border-line"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2">{error}</p>}

      {s && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Veces aplicadas" value={String(s.timesApplied)} />
            <StatCard tone="ember" label="Total descontado" value={formatMxn(s.totalDiscount)} />
            <StatCard tone="sage" label="Ventas con promoción" value={String(s.ordersWithPromo)} sublabel={`de ${s.ordersTotal} ventas`} />
            <StatCard tone="marigold" label="% de ventas" value={`${pct}%`} sublabel="usaron alguna promoción" />
          </div>

          {data.byPromotion.length === 0 ? (
            <p className="text-sm text-muted">Todavía no se ha aplicado ninguna promoción en este periodo.</p>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="overflow-hidden">
                <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted">Por promoción</p>
                <table className="w-full text-sm mt-2">
                  <tbody>
                    {data.byPromotion.map((p) => (
                      <tr key={p.name} className="border-t border-line">
                        <td className="px-4 py-2">{p.name}</td>
                        <td className="px-4 py-2 text-right text-muted">{p.timesApplied} {p.timesApplied === 1 ? "vez" : "veces"}</td>
                        <td className="px-4 py-2 text-right font-mono">{formatMxn(p.totalDiscount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card className="overflow-hidden">
                <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted">Últimos movimientos</p>
                <ul className="mt-2 max-h-72 overflow-y-auto">
                  {data.recent.map((r) => (
                    <li key={r.id} className="border-t border-line px-4 py-2 text-sm flex items-center justify-between gap-3">
                      <div>
                        <p>{r.name}</p>
                        <p className="text-xs text-muted">
                          Ticket #{r.orderNumber} · {new Date(r.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                          {r.cashier ? ` · ${r.cashier}` : ""}
                        </p>
                      </div>
                      <span className="font-mono">-{formatMxn(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
