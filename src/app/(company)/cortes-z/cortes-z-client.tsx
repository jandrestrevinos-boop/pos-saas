"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/responsive-table";
import { Modal, Field, inputClass } from "@/components/ui/modal";
import { formatMxn } from "@/lib/format";
import { CutReportView, PrintButton } from "@/components/cash/cut-report";
import type { CutReport } from "@/modules/cash/report";

type Cut = {
  id: string;
  folio: number | null;
  branchName: string;
  openedAt: string;
  closedAt: string | null;
  tickets: number;
  total: number;
  expectedCash: number | null;
  countedCash: number | null;
  difference: number | null;
};
type Branch = { id: string; name: string };

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—";
}

export function CortesZClient() {
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<CutReport | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/cash/z-history?${params.toString()}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudieron cargar los cortes");
      return;
    }
    setCuts(data.cuts);
    setBranches(data.branches);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, from, to]);

  async function view(id: string) {
    setOpening(id);
    const res = await fetch(`/api/cash/z-history/${id}`);
    const data = await res.json();
    setOpening(null);
    if (!res.ok) {
      setError(data.error ?? "No se pudo abrir el corte");
      return;
    }
    setViewing(data.report);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        {branches.length > 1 && (
          <div className="w-52">
            <Field label="Sucursal">
              <select className={inputClass} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Todas</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <div className="w-44">
          <Field label="Desde">
            <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
        </div>
        <div className="w-44">
          <Field label="Hasta">
            <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </div>

      {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}

      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-muted">Cargando...</p>
        </Card>
      ) : cuts.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-muted">
            Todavía no hay cortes Z. Aparecen aquí cuando se cierra un día desde Caja (Corte Z · Cerrar día).
          </p>
        </Card>
      ) : (
        <ResponsiveTable
          columns={
            [
              {
                key: "folio",
                header: "Folio",
                mobile: "title",
                mobileClassName: "text-base font-semibold font-mono",
                cellClassName: "font-mono font-semibold",
                render: (c: Cut) => `Z-${c.folio}`,
              },
              {
                key: "total",
                header: "Total",
                mobile: "aside",
                cellClassName: "font-mono",
                render: (c: Cut) => formatMxn(c.total),
              },
              { key: "branch", header: "Sucursal", render: (c: Cut) => c.branchName },
              {
                key: "opened",
                header: "Apertura",
                cellClassName: "text-muted text-xs",
                render: (c: Cut) => fmt(c.openedAt),
              },
              {
                key: "closed",
                header: "Cierre",
                cellClassName: "text-muted text-xs",
                render: (c: Cut) => fmt(c.closedAt),
              },
              { key: "tickets", header: "Tickets", cellClassName: "font-mono", render: (c: Cut) => c.tickets },
              {
                key: "diff",
                header: "Diferencia",
                cellClassName: "font-mono",
                render: (c: Cut) => {
                  if (c.difference === null) return "—";
                  const exact = Math.abs(c.difference) < 0.01;
                  return (
                    <span className={exact ? "text-sage" : "text-ember-dark"}>
                      {exact ? "Cuadró" : formatMxn(c.difference)}
                    </span>
                  );
                },
              },
            ] satisfies ResponsiveColumn<Cut>[]
          }
          rows={cuts}
          getRowId={(c) => c.id}
          renderActions={(c) => (
            <Button variant="ghost" onClick={() => view(c.id)} disabled={opening === c.id}>
              {opening === c.id ? "Abriendo..." : "Ver corte"}
            </Button>
          )}
        />
      )}

      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={`Corte Z${viewing.folio ? ` · Folio ${viewing.folio}` : ""}`}>
          <CutReportView report={viewing} />
          <div className="no-print flex justify-end gap-2 mt-5">
            <PrintButton />
            <Button onClick={() => setViewing(null)}>Cerrar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
