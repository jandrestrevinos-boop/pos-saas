"use client";

import type { ReactNode } from "react";
import type { CutReport } from "@/modules/cash/report";

// Sin el sufijo " MXN" de formatMxn: en un ticket angosto estorba.
function money(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function dateTime(iso: string) {
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function Row({ label, value, bold, tone }: { label: ReactNode; value: ReactNode; bold?: boolean; tone?: "bad" | "ok" }) {
  const color = tone === "bad" ? "text-ember-dark" : tone === "ok" ? "text-sage" : "";
  return (
    <div className={`flex justify-between gap-3 py-0.5 ${bold ? "font-semibold" : ""} ${color}`}>
      <span>{label}</span>
      <span className="font-mono text-right whitespace-nowrap">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4 pt-3 border-t border-dashed border-line">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">{title}</p>
      {children}
    </div>
  );
}

/** Botón de imprimir: usa el CSS de impresión de globals.css (solo sale #cut-report-print, a 80 mm). */
export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center justify-center rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-ink-100"
    >
      {label}
    </button>
  );
}

/** Ticket del corte X o Z. Es el mismo componente para pantalla, historial e impresión. */
export function CutReportView({ report }: { report: CutReport }) {
  const isZ = report.kind === "Z";
  const diff = report.cash.difference;
  const exact = diff !== null && Math.abs(diff) < 0.01;

  return (
    <div id="cut-report-print" className="text-sm leading-snug">
      <div className="text-center">
        <p className="font-display text-lg font-semibold">{report.companyName}</p>
        <p className="text-muted">{report.branchName}</p>
        <p className="mt-2 font-semibold tracking-wide">
          {isZ ? `CORTE Z — CIERRE DEL DÍA${report.folio ? ` · FOLIO ${report.folio}` : ""}` : "CORTE X — PARCIAL"}
        </p>
        {!isZ && <p className="text-xs text-muted">No cierra el día ni reinicia totales</p>}
      </div>

      <div className="mt-3 text-xs text-muted space-y-0.5">
        <Row label="Apertura" value={dateTime(report.openedAt)} />
        {report.openedBy && <Row label="Abrió" value={report.openedBy} />}
        <Row label={isZ ? "Cierre" : "Corte a las"} value={dateTime(report.generatedAt)} />
        {report.generatedBy && <Row label={isZ ? "Cerró" : "Sacó el corte"} value={report.generatedBy} />}
      </div>

      <Section title="Ventas">
        <Row label="Tickets" value={report.sales.tickets} />
        <Row label="Ticket promedio" value={money(report.sales.averageTicket)} />
        <Row label="Subtotal" value={money(report.sales.subtotal)} />
        <Row label="Descuentos" value={`-${money(report.sales.discounts)}`} />
        <Row label="Total vendido" value={money(report.sales.total)} bold />
        {(report.sales.tips ?? 0) > 0 && (
          <>
            <Row label="Propinas" value={money(report.sales.tips ?? 0)} />
            <Row label="Total cobrado (con propinas)" value={money(report.sales.totalCollected ?? report.sales.total)} bold />
          </>
        )}
      </Section>

      <Section title="Por método de pago">
        {report.byMethod.length === 0 ? (
          <p className="text-muted">Sin ventas todavía.</p>
        ) : (
          report.byMethod.map((m) => (
            <Row key={m.method} label={`${m.label} (${m.count})`} value={money(m.amount)} />
          ))
        )}
        {(report.sales.tips ?? 0) > 0 && (
          <p className="text-xs text-muted mt-1">Los montos por método no incluyen propinas.</p>
        )}
      </Section>

      {report.byOrderType.length > 0 && (
        <Section title="Por tipo de pedido">
          {report.byOrderType.map((t) => (
            <Row key={t.type} label={`${t.label} (${t.count})`} value={money(t.amount)} />
          ))}
        </Section>
      )}

      {report.byCashier.length > 0 && (
        <Section title="Por cajero">
          {report.byCashier.map((c) => (
            <Row key={c.name} label={`${c.name} (${c.tickets})`} value={money(c.amount)} />
          ))}
        </Section>
      )}

      {report.promotions.length > 0 && (
        <Section title="Promociones aplicadas">
          {report.promotions.map((p) => (
            <Row key={p.name} label={`${p.name} (${p.count})`} value={`-${money(p.amount)}`} />
          ))}
        </Section>
      )}

      {(report.cancellations.sameDay.count > 0 || report.cancellations.previousDays.count > 0) && (
        <Section title="Cancelaciones">
          {report.cancellations.sameDay.count > 0 && (
            <>
              <Row
                label={`Ventas de hoy canceladas (${report.cancellations.sameDay.count})`}
                value={money(report.cancellations.sameDay.amount)}
              />
              <p className="text-xs text-muted">
                Ya no están en las ventas de arriba. Tickets:{" "}
                {report.cancellations.sameDay.items.map((i) => `#${i.orderNumber}`).join(", ")}
              </p>
            </>
          )}
          {report.cancellations.previousDays.count > 0 && (
            <div className="mt-2">
              <Row
                label={`Ajuste: ventas de días anteriores (${report.cancellations.previousDays.count})`}
                value={money(report.cancellations.previousDays.amount)}
              />
              <p className="text-xs text-muted">
                Tickets: {report.cancellations.previousDays.items.map((i) => `#${i.orderNumber}`).join(", ")}. El corte
                Z de esos días no cambia.
                {report.cancellations.previousDays.cashAmount > 0 &&
                  ` Si se devolvió efectivo (${money(report.cancellations.previousDays.cashAmount)}), regístralo como Devolución en Caja.`}
              </p>
            </div>
          )}
        </Section>
      )}

      <Section title="Efectivo en caja">
        <Row label="Fondo inicial" value={money(report.cash.opening)} />
        <Row label="Ventas en efectivo" value={money(report.cash.sales)} />
        {(report.cash.tips ?? 0) > 0 && <Row label="Propinas en efectivo" value={money(report.cash.tips ?? 0)} />}
        <Row label="Entradas" value={money(report.cash.cashIn)} />
        <Row label="Retiros y devoluciones" value={`-${money(report.cash.cashOut)}`} />
        <Row label="Efectivo esperado" value={money(report.cash.expected)} bold />
        {report.cash.counted !== null && <Row label="Efectivo contado" value={money(report.cash.counted)} bold />}
        {diff !== null && (
          <Row
            label={exact ? "Cuadró exacto" : diff > 0 ? "Sobrante" : "Faltante"}
            value={exact ? money(0) : money(Math.abs(diff))}
            bold
            tone={exact ? "ok" : "bad"}
          />
        )}
      </Section>

      {report.movements.length > 0 && (
        <Section title="Movimientos de caja">
          {report.movements.map((m, i) => (
            <Row
              key={i}
              label={`${m.label}${m.reason ? ` · ${m.reason}` : ""}`}
              value={`${m.type === "CASH_IN" ? "+" : "-"}${money(m.amount)}`}
            />
          ))}
        </Section>
      )}

      {(report.pending.openTabs > 0 || report.pending.pendingPayments > 0 || report.pending.whatsappUnpaid > 0) && (
        <Section title="Pendientes">
          {report.pending.openTabs > 0 && <Row label="Cuentas de mesa abiertas" value={report.pending.openTabs} />}
          {report.pending.pendingPayments > 0 && (
            <Row label="Pagos de Mercado Pago sin confirmar" value={report.pending.pendingPayments} />
          )}
          {report.pending.whatsappUnpaid > 0 && (
            <Row label="Pedidos de WhatsApp sin cobrar" value={report.pending.whatsappUnpaid} />
          )}
          {isZ ? null : (
            <p className="text-xs text-muted mt-1">Las cuentas de mesa y los pagos sin confirmar impiden hacer el corte Z.</p>
          )}
        </Section>
      )}

      <p className="mt-4 pt-3 border-t border-dashed border-line text-center text-xs text-muted">
        {isZ ? "Documento de cierre — no se puede modificar" : "Corte parcial — informativo"}
      </p>
    </div>
  );
}
