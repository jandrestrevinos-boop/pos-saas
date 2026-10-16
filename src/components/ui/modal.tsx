"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Computadora/tablet ancha: ventana centrada (igual que antes).
 * Celular: hoja que sube desde abajo, con el título fijo y el contenido con scroll propio,
 * para que un formulario largo nunca quede cortado.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  // Con el modal abierto, la página de atrás no se mueve.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-ink-950/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative bg-paper-raised border border-line w-full sm:max-w-md flex flex-col max-h-[92dvh] rounded-t-2xl sm:rounded-lg shadow-xl animate-sheet-in"
      >
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 shrink-0">
          <h2 className="font-display text-xl font-semibold min-w-0 break-words">{title}</h2>
          <button
            onClick={onClose}
            className="shrink-0 h-10 w-10 -mr-2 inline-flex items-center justify-center rounded-md text-muted hover:text-ink text-2xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 sm:px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-line bg-paper px-3 py-2.5 sm:py-2 text-sm focus:border-ember outline-none";
