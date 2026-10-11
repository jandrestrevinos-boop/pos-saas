"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import type { ProductImportAnalysis, ProductImportResult } from "@/modules/import/products-import";

const MAX_BYTES = 4 * 1024 * 1024;

type Step = "pick" | "preview" | "done";

const STATUS_LABEL: Record<string, string> = {
  create: "Nuevo",
  update: "Actualiza",
  error: "Error",
};
const STATUS_CLASS: Record<string, string> = {
  create: "bg-sage/10 text-sage",
  update: "bg-marigold/10 text-marigold",
  error: "bg-ember/10 text-ember-dark",
};

export function ImportProductsButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProductImportAnalysis | null>(null);
  const [result, setResult] = useState<ProductImportResult | null>(null);
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

  function close() {
    const imported = step === "done";
    setOpen(false);
    reset();
    // La tabla de productos guarda su lista en memoria: recargamos para ver lo importado.
    if (imported) window.location.reload();
  }

  async function send<T>(mode: "preview" | "commit"): Promise<T> {
    if (!file) throw new Error("Selecciona un archivo");
    const body = new FormData();
    body.append("file", file);
    body.append("mode", mode);

    const res = await fetch("/api/products/import", { method: "POST", body });
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!data) throw new Error("El servidor no respondió correctamente. Intenta de nuevo.");
    if (!res.ok) throw new Error(data.error ?? "Ocurrió un error");
    return data;
  }

  async function handlePreview() {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("El archivo es muy grande (máximo 4 MB). Divídelo en varios archivos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setPreview(await send<ProductImportAnalysis>("preview"));
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
      setResult(await send<ProductImportResult>("commit"));
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar");
    } finally {
      setLoading(false);
    }
  }

  const importable = preview ? preview.toCreate + preview.toUpdate : 0;
  const shownRows = preview
    ? [...preview.rows]
        .filter((r) => r.status !== "skip")
        .sort((a, b) => Number(b.status === "error") - Number(a.status === "error"))
        .slice(0, 200)
    : [];

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Importar productos
      </Button>

      <Modal open={open} onClose={close} title="Importar productos">
        {step === "pick" && (
          <div>
            <p className="text-sm text-muted mb-3">
              Sube un archivo de Excel (.xlsx) o CSV con tus productos. Antes de guardar nada verás una vista previa.
            </p>
            <p className="text-sm mb-4">
              <a href="/api/products/import" className="underline text-ember">
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
            {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                Cancelar
              </Button>
              <Button type="button" disabled={!file || loading} onClick={handlePreview}>
                {loading ? "Revisando..." : "Revisar archivo"}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && preview && (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <div className="rounded-md border border-line p-3">
                <div className="text-2xl font-mono">{preview.toCreate}</div>
                <div className="text-xs text-muted">Nuevos</div>
              </div>
              <div className="rounded-md border border-line p-3">
                <div className="text-2xl font-mono">{preview.toUpdate}</div>
                <div className="text-xs text-muted">Se actualizan</div>
              </div>
              <div className="rounded-md border border-line p-3">
                <div className="text-2xl font-mono">{preview.errors}</div>
                <div className="text-xs text-muted">Con error</div>
              </div>
            </div>

            {preview.newCategories.length > 0 && (
              <p className="text-sm mb-3">
                <span className="text-muted">Categorías nuevas que se crearán: </span>
                {preview.newCategories.join(", ")}
              </p>
            )}
            {preview.errors > 0 && (
              <p className="text-sm text-ember-dark mb-3">
                Las filas con error no se importan. Corrígelas en tu archivo y vuelve a subirlo, o importa solo las
                válidas.
              </p>
            )}

            <div className="max-h-72 overflow-auto border border-line rounded-md mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">Fila</th>
                    <th className="px-3 py-2 font-medium">Producto</th>
                    <th className="px-3 py-2 font-medium">Categoría</th>
                    <th className="px-3 py-2 font-medium">Precio</th>
                    <th className="px-3 py-2 font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map((r) => (
                    <tr key={r.line} className="border-b border-line last:border-0 align-top">
                      <td className="px-3 py-2 font-mono text-muted">{r.line}</td>
                      <td className="px-3 py-2">{r.name || "—"}</td>
                      <td className="px-3 py-2 text-muted">{r.category || "—"}</td>
                      <td className="px-3 py-2 font-mono">
                        {r.price !== undefined
                          ? r.price.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_CLASS[r.status] ?? ""}`}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                        {r.errors.length > 0 && <div className="text-xs text-ember-dark mt-1">{r.errors.join(". ")}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 200 && (
              <p className="text-xs text-muted mb-3">Mostrando las primeras 200 filas (los errores van primero).</p>
            )}

            {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={reset} disabled={loading}>
                Elegir otro archivo
              </Button>
              <Button type="button" disabled={loading || importable === 0} onClick={handleCommit}>
                {loading ? "Importando..." : `Importar ${importable} producto${importable === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div>
            <p className="text-sm mb-2">Importación terminada:</p>
            <ul className="text-sm mb-4 space-y-1">
              <li>
                <span className="font-mono">{result.created}</span> productos nuevos
              </li>
              <li>
                <span className="font-mono">{result.updated}</span> productos actualizados
              </li>
              {result.categoriesCreated > 0 && (
                <li>
                  <span className="font-mono">{result.categoriesCreated}</span> categorías creadas
                </li>
              )}
              {result.skippedWithErrors > 0 && (
                <li className="text-ember-dark">
                  <span className="font-mono">{result.skippedWithErrors}</span> filas omitidas por errores
                </li>
              )}
            </ul>
            <div className="flex justify-end">
              <Button type="button" onClick={close}>
                Listo
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
