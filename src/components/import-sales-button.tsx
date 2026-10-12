"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { SalesImportAnalysis, SalesImportResult } from "@/modules/import/sales-import";

const MAX_BYTES = 4 * 1024 * 1024;
type Step = "pick" | "preview" | "done";

const mxn = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-MX", { timeZone: "America/Monterrey" }) : "—";

export function ImportSalesButton() {
  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SalesImportAnalysis | null>(null);
  const [result, setResult] = useState<SalesImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setStep("pick");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    setLoading(false);
  }

  async function send<T>(mode: "preview" | "commit"): Promise<T> {
    if (!file) throw new Error("Selecciona un archivo");
    const body = new FormData();
    body.append("file", file);
    body.append("mode", mode);
    const res = await fetch("/api/sales/import", { method: "POST", body });
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!data) throw new Error("El servidor no respondió correctamente. Intenta de nuevo.");
    if (!res.ok) throw new Error(data.error ?? "Ocurrió un error");
    return data;
  }

  async function handlePreview() {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("El archivo es muy grande (máximo 4 MB). Divídelo por periodos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setPreview(await send<SalesImportAnalysis>("preview"));
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo revisar el archivo");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    setLoading(true);
    setError("");
    try {
      setResult(await send<SalesImportResult>("commit"));
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar");
    } finally {
      setLoading(false);
    }
  }

  const errBox = error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>;

  return (
    <div className="max-w-3xl">
      {step === "pick" && (
        <div>
          <p className="text-sm text-muted mb-3">
            Sube el historial de ventas de tu sistema anterior en Excel (.xlsx) o CSV. Antes de guardar nada verás una
            vista previa.
          </p>
          <p className="text-sm mb-4">
            <a href="/api/sales/import" className="underline text-ember">
              Descargar plantilla de Excel
            </a>
          </p>
          <input
            type="file"
            accept=".xlsx,.csv"
            className="block w-full text-sm mb-4"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError("");
            }}
          />
          {errBox}
          <Button type="button" disabled={!file || loading} onClick={handlePreview}>
            {loading ? "Revisando..." : "Revisar archivo"}
          </Button>
        </div>
      )}

      {step === "preview" && preview && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            <div className="rounded-md border border-line p-3">
              <div className="text-2xl font-mono">{preview.tickets}</div>
              <div className="text-xs text-muted">Tickets a importar</div>
            </div>
            <div className="rounded-md border border-line p-3">
              <div className="text-2xl font-mono">{mxn(preview.total)}</div>
              <div className="text-xs text-muted">Total de ventas</div>
            </div>
            <div className="rounded-md border border-line p-3">
              <div className="text-2xl font-mono">{preview.errors}</div>
              <div className="text-xs text-muted">Filas con error</div>
            </div>
          </div>

          {preview.tickets > 0 && (
            <p className="text-sm mb-2">
              <span className="text-muted">Periodo: </span>
              {day(preview.from)} a {day(preview.to)} ({preview.lines} renglones)
            </p>
          )}
          {preview.alreadyImported > 0 && (
            <p className="text-sm mb-2 text-muted">
              {preview.alreadyImported} tickets ya estaban importados y se omiten.
            </p>
          )}
          {preview.newProducts.length > 0 && (
            <p className="text-sm mb-3">
              <span className="text-muted">
                Productos que no existen en Tappy (se crean inactivos, no aparecen en el POS):{" "}
              </span>
              {preview.newProducts.slice(0, 30).join(", ")}
              {preview.newProducts.length > 30 ? ` y ${preview.newProducts.length - 30} más` : ""}
            </p>
          )}

          {preview.errorRows.length > 0 && (
            <div className="max-h-60 overflow-auto border border-line rounded-md mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">Fila</th>
                    <th className="px-3 py-2 font-medium">Folio</th>
                    <th className="px-3 py-2 font-medium">Producto</th>
                    <th className="px-3 py-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errorRows.map((r) => (
                    <tr key={r.line} className="border-b border-line last:border-0 align-top">
                      <td className="px-3 py-2 font-mono text-muted">{r.line}</td>
                      <td className="px-3 py-2">{r.folio || "—"}</td>
                      <td className="px-3 py-2 text-muted">{r.product || "—"}</td>
                      <td className="px-3 py-2 text-ember-dark">{r.errors.join(". ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.errors > 0 && (
            <p className="text-sm text-ember-dark mb-3">
              Un ticket con error en cualquiera de sus filas se omite completo. Corrígelo en tu archivo y vuelve a
              subirlo: los tickets ya importados no se duplican.
            </p>
          )}

          {errBox}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={reset} disabled={loading}>
              Elegir otro archivo
            </Button>
            <Button type="button" disabled={loading || preview.tickets === 0} onClick={handleCommit}>
              {loading ? "Importando..." : `Importar ${preview.tickets} ticket${preview.tickets === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div>
          <p className="text-sm mb-2">Importación terminada:</p>
          <ul className="text-sm mb-4 space-y-1">
            <li>
              <span className="font-mono">{result.tickets}</span> tickets importados ({mxn(result.total)})
            </li>
            {result.productsCreated > 0 && (
              <li>
                <span className="font-mono">{result.productsCreated}</span> productos creados como inactivos
              </li>
            )}
            {result.alreadyImported > 0 && (
              <li>
                <span className="font-mono">{result.alreadyImported}</span> tickets ya existían y se omitieron
              </li>
            )}
            {result.skippedWithErrors > 0 && (
              <li className="text-ember-dark">
                <span className="font-mono">{result.skippedWithErrors}</span> filas omitidas por errores
              </li>
            )}
          </ul>
          <Button type="button" onClick={reset}>
            Importar otro archivo
          </Button>
        </div>
      )}
    </div>
  );
}
