"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/image-client";

/** Sube una imagen (comprimida en el navegador) y devuelve su URL. kind = "logo" | "product". */
export function ImageUploader({
  kind,
  value,
  onChange,
}: {
  kind: "logo" | "product";
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Selecciona un archivo de imagen (JPG, PNG o WebP).");
      return;
    }
    setBusy(true);
    try {
      const small = await compressImage(file, kind);
      const body = new FormData();
      body.append("file", small);
      body.append("kind", kind);
      const res = await fetch("/api/uploads/image", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!data) throw new Error("El servidor no respondió correctamente. Intenta de nuevo.");
      if (!res.ok || !data.url) throw new Error(data.error ?? "No se pudo subir la imagen");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const isLogo = kind === "logo";

  return (
    <div>
      <div className="flex items-center gap-3">
        <div
          className={`shrink-0 rounded-md border border-line bg-paper flex items-center justify-center overflow-hidden ${
            isLogo ? "w-24 h-16" : "w-20 h-20"
          }`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className={`w-full h-full ${isLogo ? "object-contain p-1" : "object-cover"}`} />
          ) : (
            <span className="text-xs text-muted">Sin imagen</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-line px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Subiendo..." : value ? "Cambiar" : isLogo ? "Subir logo" : "Subir foto"}
          </button>
          {value && !busy && (
            <button type="button" onClick={() => onChange(null)} className="text-xs underline text-muted text-left">
              Quitar
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mt-2">{error}</p>}
    </div>
  );
}
