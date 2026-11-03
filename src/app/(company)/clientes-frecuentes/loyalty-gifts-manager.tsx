"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { inputClass } from "@/components/ui/modal";

export type Gift = {
  id: string;
  name: string;
  description: string | null;
  productId: string | null;
  isActive: boolean;
  linked: boolean;
  productActive: boolean;
};

type PosProduct = { id: string; name: string; price: number; category: string | null; alreadyGift: boolean };
type Tab = "pos" | "manual" | "lista";

/**
 * Catálogo de productos de regalo del programa de clientes frecuentes.
 * - Con POS: se vinculan productos ya dados de alta (al canjear en Caja entran a la venta en $0).
 * - Sin POS (o para regalos que no se venden): se escriben a mano, uno por uno o pegando una lista.
 */
export function LoyaltyGiftsManager({ initialGifts, posAvailable }: { initialGifts: Gift[]; posAvailable: boolean }) {
  const [gifts, setGifts] = useState(initialGifts);
  const [tab, setTab] = useState<Tab>(posAvailable ? "pos" : "manual");
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function reloadGifts() {
    const res = await fetch("/api/loyalty/gifts");
    if (res.ok) setGifts((await res.json()).gifts);
  }

  async function loadProducts(term: string) {
    setLoadingProducts(true);
    const res = await fetch(`/api/loyalty/pos-products?q=${encodeURIComponent(term)}`);
    setLoadingProducts(false);
    if (res.ok) setProducts((await res.json()).products);
  }

  // Buscador de productos del POS (con una pequeña espera para no consultar en cada tecla).
  useEffect(() => {
    if (!posAvailable || tab !== "pos") return;
    const t = setTimeout(() => loadProducts(q), 250);
    return () => clearTimeout(t);
  }, [q, tab, posAvailable]);

  async function post(body: unknown, okText: string) {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/loyalty/gifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ ok: false, text: data.error ?? "No se pudo agregar" });
      return false;
    }
    setMessage({ ok: true, text: data.created !== undefined ? `${data.created} regalo(s) agregado(s)${data.skipped ? `, ${data.skipped} omitido(s) por repetidos o inválidos` : ""}` : okText });
    await reloadGifts();
    return true;
  }

  async function addFromPos(p: PosProduct) {
    if (await post({ productId: p.id }, `"${p.name}" agregado a los regalos`)) {
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, alreadyGift: true } : x)));
    }
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (await post({ name, description: description || null }, `"${name}" agregado a los regalos`)) {
      setName("");
      setDescription("");
    }
  }

  async function addBulk(e: React.FormEvent) {
    e.preventDefault();
    // Un producto por línea; si viene de un CSV se toma la primera columna.
    const names = bulk
      .split(/\r?\n/)
      .map((line) => line.split(/[,;\t]/)[0].replace(/^"|"$/g, "").trim())
      .filter(Boolean);
    if (names.length === 0) {
      setMessage({ ok: false, text: "Pega al menos un producto (uno por línea)" });
      return;
    }
    if (await post({ names }, "")) setBulk("");
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    setBulk(await file.text());
  }

  async function patch(g: Gift, body: Partial<Pick<Gift, "isActive">>) {
    setMessage(null);
    const res = await fetch(`/api/loyalty/gifts/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ ok: false, text: data.error ?? "No se pudo actualizar" });
      return;
    }
    setGifts((prev) => prev.map((x) => (x.id === g.id ? data.gift : x)));
  }

  async function remove(g: Gift) {
    if (!window.confirm(`¿Quitar "${g.name}" de los regalos? Los canjes anteriores conservan su registro.`)) return;
    setMessage(null);
    const res = await fetch(`/api/loyalty/gifts/${g.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ ok: false, text: data.error ?? "No se pudo eliminar" });
      return;
    }
    setGifts((prev) => prev.filter((x) => x.id !== g.id));
    if (posAvailable && tab === "pos") loadProducts(q);
  }

  const tabs: { id: Tab; label: string }[] = [
    ...(posAvailable ? [{ id: "pos" as Tab, label: "Productos de mi POS" }] : []),
    { id: "manual", label: "Escribir uno" },
    { id: "lista", label: "Pegar lista / archivo" },
  ];

  return (
    <Card className="p-6">
      <h2 className="font-display text-xl font-semibold mb-1">Productos de regalo</h2>
      <p className="text-sm text-muted mb-5">
        Estos son los productos que tu cliente puede ganar. Si hay más de uno, el cajero elige cuál entregar al canjear.
        {posAvailable
          ? " Los que vincules con tu POS se agregan a la venta en $0 y descuentan inventario."
          : " Escríbelos o súbelos en lista; no necesitas tener POS."}
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Catálogo actual */}
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-2">En tu lista ({gifts.length})</p>
          {gifts.length === 0 ? (
            <p className="text-sm text-muted border border-dashed border-line rounded-lg px-4 py-6 text-center">
              Aún no hay productos de regalo. Agrega al menos uno para activar esta recompensa.
            </p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {gifts.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 border border-line rounded-lg px-3 py-2.5">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${g.isActive ? "" : "text-muted line-through"}`}>{g.name}</p>
                    <p className="text-[11px] text-muted">
                      {g.linked ? (g.productActive ? "Vinculado a tu POS" : "Vinculado a tu POS (producto inactivo)") : "Escrito a mano"}
                      {g.description ? ` · ${g.description}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" onClick={() => patch(g, { isActive: !g.isActive })}>
                      {g.isActive ? "Pausar" : "Activar"}
                    </Button>
                    <Button variant="ghost" onClick={() => remove(g)}>
                      Quitar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Agregar */}
        <div>
          <div className="flex gap-1 mb-3 border-b border-line">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setMessage(null);
                }}
                className={`px-3 py-2 text-sm -mb-px border-b-2 ${
                  tab === t.id ? "border-ember font-medium text-ink" : "border-transparent text-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "pos" && (
            <div>
              <input className={`${inputClass} mb-3`} placeholder="Buscar en tus productos" value={q} onChange={(e) => setQ(e.target.value)} />
              <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm px-1">
                    <span className="truncate">
                      {p.name}
                      <span className="text-muted text-xs">
                        {p.category ? ` · ${p.category}` : ""} · ${p.price.toFixed(2)}
                      </span>
                    </span>
                    {p.alreadyGift ? (
                      <span className="text-xs text-sage shrink-0">Ya es regalo</span>
                    ) : (
                      <Button variant="secondary" onClick={() => addFromPos(p)} disabled={busy}>
                        Agregar
                      </Button>
                    )}
                  </li>
                ))}
                {!loadingProducts && products.length === 0 && (
                  <li className="text-sm text-muted">No encontramos productos. Da de alta productos en tu POS o escríbelos a mano.</li>
                )}
              </ul>
            </div>
          )}

          {tab === "manual" && (
            <form onSubmit={addManual} className="space-y-3">
              <input className={inputClass} placeholder="Nombre (ej. Café americano)" value={name} onChange={(e) => setName(e.target.value)} required />
              <input className={inputClass} placeholder="Detalle (opcional, ej. 12 oz)" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Button type="submit" disabled={busy || name.trim().length < 2}>
                Agregar regalo
              </Button>
            </form>
          )}

          {tab === "lista" && (
            <form onSubmit={addBulk} className="space-y-3">
              <textarea
                className={`${inputClass} h-36`}
                placeholder={"Un producto por línea:\nCafé americano\nPostre del día\nOrden de papas"}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs text-muted">
                  o sube un archivo CSV/TXT:{" "}
                  <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => loadFile(e.target.files?.[0])} />
                </label>
              </div>
              <Button type="submit" disabled={busy || !bulk.trim()}>
                Agregar lista
              </Button>
            </form>
          )}

          {message && (
            <p className={`text-sm rounded-md px-3 py-2 mt-3 ${message.ok ? "bg-sage-light text-sage" : "bg-ember/10 text-ember-dark"}`}>
              {message.text}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
