"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatMxn } from "@/lib/format";

type Category = { id: string; name: string };
type Product = { id: string; name: string; price: string; categoryId: string };
type CartLine = { product: Product; quantity: number };

const PAYMENT_METHODS: { value: "CASH" | "CARD" | "TRANSFER" | "OTHER"; label: string }[] = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "OTHER", label: "Otro" },
];

export function PosClient({
  categories,
  products,
  userName,
}: {
  categories: Category[];
  products: Product[];
  userName: string;
}) {
  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id ?? "");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const visibleProducts = useMemo(
    () => products.filter((p) => p.categoryId === activeCategory),
    [products, activeCategory]
  );

  const subtotal = cart.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0);
  const safeDiscount = Math.min(discount, subtotal);
  const total = subtotal - safeDiscount;

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function resetSale() {
    setCart([]);
    setDiscount(0);
    setCheckoutOpen(false);
  }

  return (
    <div className="h-screen flex flex-col bg-paper">
      {/* Encabezado */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-line bg-paper-raised shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
            ← Salir
          </Link>
          <p className="font-display text-lg font-semibold">Punto de Venta</p>
        </div>
        <p className="text-sm text-muted">{userName}</p>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Columna izquierda: categorías + productos */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex gap-2 px-5 py-4 overflow-x-auto shrink-0 border-b border-line bg-paper-raised">
            {categories.length === 0 ? (
              <p className="text-sm text-muted">No hay categorías activas.</p>
            ) : (
              categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`shrink-0 rounded-md px-5 py-3 text-sm font-medium transition-colors ${
                    activeCategory === c.id ? "bg-ink-950 text-white" : "bg-white border border-line text-ink"
                  }`}
                >
                  {c.name}
                </button>
              ))
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="bg-paper-raised border border-line rounded-lg p-4 text-left active:scale-[0.98] transition-transform hover:border-ember"
                >
                  <p className="font-medium mb-1">{p.name}</p>
                  <p className="font-mono text-sm text-muted">{formatMxn(p.price)}</p>
                </button>
              ))}
              {visibleProducts.length === 0 && (
                <p className="text-sm text-muted col-span-full">No hay productos en esta categoría.</p>
              )}
            </div>
          </div>
        </div>

        {/* Columna derecha: carrito */}
        <aside className="w-full max-w-sm border-l border-line bg-paper-raised flex flex-col shrink-0">
          <div className="px-5 py-4 border-b border-line">
            <p className="font-display text-lg font-semibold">Carrito</p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3">
            {cart.length === 0 ? (
              <p className="text-sm text-muted text-center py-10">Toca un producto para agregarlo.</p>
            ) : (
              <ul className="space-y-3">
                {cart.map((line) => (
                  <li key={line.product.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{line.product.name}</p>
                      <p className="text-xs text-muted font-mono">{formatMxn(line.product.price)} c/u</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => changeQuantity(line.product.id, -1)}
                        className="w-8 h-8 rounded-md border border-line text-lg leading-none"
                        aria-label="Restar"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-mono text-sm">{line.quantity}</span>
                      <button
                        onClick={() => changeQuantity(line.product.id, 1)}
                        className="w-8 h-8 rounded-md border border-line text-lg leading-none"
                        aria-label="Sumar"
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ticket-edge px-5 py-4 space-y-2">
            <label className="flex items-center justify-between text-sm">
              <span className="text-muted">Descuento (MXN)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount || ""}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-24 rounded-md border border-line px-2 py-1 text-right font-mono"
                placeholder="0.00"
              />
            </label>
            <div className="flex items-center justify-between text-sm text-muted">
              <span>Subtotal</span>
              <span className="font-mono">{formatMxn(subtotal)}</span>
            </div>
          </div>

          <div className="px-5 pb-5 pt-3">
            <div className="flex items-center justify-between mb-4">
              <span className="font-display text-xl font-semibold">Total</span>
              <span className="font-display text-2xl font-semibold">{formatMxn(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={resetSale}
                disabled={cart.length === 0}
                className="rounded-md border border-line py-3 text-sm font-medium disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={() => setCheckoutOpen(true)}
                disabled={cart.length === 0}
                className="rounded-md bg-ember text-white py-3 text-sm font-medium disabled:opacity-40"
              >
                Cobrar
              </button>
            </div>
          </div>
        </aside>
      </div>

      {checkoutOpen && (
        <CheckoutModal total={total} discount={safeDiscount} subtotal={subtotal} cart={cart} onClose={() => setCheckoutOpen(false)} onDone={resetSale} />
      )}
    </div>
  );
}

function CheckoutModal({
  total,
  discount,
  subtotal,
  cart,
  onClose,
  onDone,
}: {
  total: number;
  discount: number;
  subtotal: number;
  cart: CartLine[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [method, setMethod] = useState<"CASH" | "CARD" | "TRANSFER" | "OTHER">("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [completedOrder, setCompletedOrder] = useState<{
    orderNumber: number;
    items: { quantity: number; name: string; unitPrice: number }[];
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: string;
    cashReceived: number;
    change: number;
  } | null>(null);

  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const change = cashReceivedNum - total;

  async function handleConfirm() {
    setError("");

    if (method === "CASH" && cashReceivedNum < total) {
      setError("El efectivo recibido es menor al total.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
          })),
          discount,
          paymentMethod: method,
          cashReceived: method === "CASH" ? cashReceivedNum : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo registrar la venta");
        return;
      }

      setCompletedOrder({
        orderNumber: data.order.orderNumber,
        items: cart.map((l) => ({
          quantity: l.quantity,
          name: l.product.name,
          unitPrice: Number(l.product.price),
        })),
        subtotal,
        discount,
        total,
        paymentMethod: method,
        cashReceived: cashReceivedNum,
        change: Math.max(change, 0),
      });
    } catch (err) {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  // -----------------------------
  // TICKET DE VENTA COMPLETADA
  // -----------------------------
  if (completedOrder) {
    const printTicket = () => {
      const win = window.open("", "_blank", "width=302,height=600");

      if (!win) return;

      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8"/>
          <title>Ticket #${completedOrder.orderNumber}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Courier New', monospace;
              font-size: 11px;
              width: 72mm;
              padding: 4mm;
              color: #000;
            }

            .center {
              text-align: center;
            }

            .bold {
              font-weight: bold;
            }

            .large {
              font-size: 14px;
            }

            .divider {
              border-top: 1px dashed #000;
              margin: 4px 0;
            }

            .row {
              display: flex;
              justify-content: space-between;
            }

            .total-row {
              font-size: 13px;
              font-weight: bold;
            }
          </style>
        </head>

        <body>
          <div class="center bold large">Tappy</div>

          <div
            class="center"
            style="margin-bottom:6px;font-size:10px;"
          >
            Punto de Venta
          </div>

          <div class="divider"></div>

          <div class="row">
            <span>Folio:</span>
            <span>#${completedOrder.orderNumber}</span>
          </div>

          <div class="row">
            <span>Fecha:</span>
            <span>
              ${new Date().toLocaleString("es-MX", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
          </div>

          <div class="divider"></div>

          ${completedOrder.items
            .map(
              (item) => `
                <div class="row">
                  <span>${item.quantity}x ${item.name}</span>
                  <span>
                    $${(item.quantity * item.unitPrice).toFixed(2)}
                  </span>
                </div>
              `
            )
            .join("")}

          <div class="divider"></div>

          <div class="row">
            <span>Subtotal</span>
            <span>$${completedOrder.subtotal.toFixed(2)}</span>
          </div>

          ${
            completedOrder.discount > 0
              ? `
                <div class="row">
                  <span>Descuento</span>
                  <span>-$${completedOrder.discount.toFixed(2)}</span>
                </div>
              `
              : ""
          }

          <div class="row total-row">
            <span>TOTAL</span>
            <span>$${completedOrder.total.toFixed(2)}</span>
          </div>

          ${
            completedOrder.paymentMethod === "CASH" &&
            completedOrder.change > 0
              ? `
                <div class="row">
                  <span>Efectivo</span>
                  <span>$${completedOrder.cashReceived.toFixed(2)}</span>
                </div>

                <div class="row">
                  <span>Cambio</span>
                  <span>$${completedOrder.change.toFixed(2)}</span>
                </div>
              `
              : ""
          }

          <div class="divider"></div>

          <div
            class="center"
            style="margin-top:4px;font-size:10px;"
          >
            ¡Gracias por su compra!
          </div>

          <div
            class="center"
            style="font-size:9px;margin-top:2px;"
          >
            Powered by Tappy
          </div>

          <br/>
          <br/>
        </body>
        </html>
      `);

      win.document.close();
      win.focus();
      win.print();
      win.close();
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-ink-950/50" />

        <div className="relative bg-paper-raised rounded-lg border border-line w-full max-w-sm p-8 text-center">
          <p className="text-sage text-4xl mb-3">✓</p>

          <p className="font-display text-2xl font-semibold mb-1">
            Venta registrada
          </p>

          <p className="text-muted text-sm mb-1">
            Folio #{completedOrder.orderNumber}
          </p>

          <p className="font-mono text-xl mb-6">
            {formatMxn(completedOrder.total)}
          </p>

          <button
            onClick={printTicket}
            className="w-full rounded-md border border-line py-3 text-sm font-medium mb-3"
          >
            🖨️ Imprimir ticket
          </button>

          <button
            onClick={onDone}
            className="w-full rounded-md bg-ember text-white py-3 text-sm font-medium"
          >
            Nueva venta
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------
  // MODAL DE COBRO
  // -----------------------------
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-950/50"
        onClick={onClose}
      />

      <div className="relative bg-paper-raised rounded-lg border border-line w-full max-w-sm p-6">
        <h2 className="font-display text-2xl font-semibold mb-1">
          Cobrar venta
        </h2>

        <p className="text-muted text-sm mb-6">
          Total:{" "}
          <span className="font-mono font-semibold text-ink">
            {formatMxn(total)}
          </span>
        </p>

        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            type="button"
            onClick={() => setMethod("CASH")}
            className={`rounded-md border py-3 text-sm font-medium ${
              method === "CASH"
                ? "bg-ember text-white border-ember"
                : "border-line"
            }`}
          >
            Efectivo
          </button>

          <button
            type="button"
            onClick={() => setMethod("CARD")}
            className={`rounded-md border py-3 text-sm font-medium ${
              method === "CARD"
                ? "bg-ember text-white border-ember"
                : "border-line"
            }`}
          >
            Tarjeta
          </button>

          <button
            type="button"
            onClick={() => setMethod("TRANSFER")}
            className={`rounded-md border py-3 text-sm font-medium ${
              method === "TRANSFER"
                ? "bg-ember text-white border-ember"
                : "border-line"
            }`}
          >
            Transferencia
          </button>

          <button
            type="button"
            onClick={() => setMethod("OTHER")}
            className={`rounded-md border py-3 text-sm font-medium ${
              method === "OTHER"
                ? "bg-ember text-white border-ember"
                : "border-line"
            }`}
          >
            Otro
          </button>
        </div>

        {method === "CASH" && (
          <div className="mb-5 space-y-2">
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">
                Efectivo recibido
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 font-mono"
                placeholder="0.00"
              />
            </label>

            {cashReceivedNum > 0 && (
              <p className="text-sm text-muted">
                Cambio:{" "}
                <span className="font-mono font-medium text-ink">
                  {formatMxn(Math.max(change, 0))}
                </span>
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-line py-3 text-sm font-medium"
          >
            Cancelar
          </button>

          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 rounded-md bg-ember text-white py-3 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}