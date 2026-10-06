"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Button, Card } from "@/components/ui";
import { Field, inputClass } from "@/components/ui/modal";
import { QrImage } from "@/components/loyalty/qr-image";

type CustomerSummary = {
  id: string;
  name: string;
  phone: string | null;
  shortCode: string | null;
  visits: number;
  required: number;
  rewardAvailable: boolean;
  visitedToday: boolean;
  programActive: boolean;
  discountText: string;
  redeemed?: string;
};

export function ScanClient() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastScanRef = useRef(0);
  const lockedRef = useRef(false); // true mientras hay un resultado en pantalla o una búsqueda en curso

  const [cameraOn, setCameraOn] = useState(false);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [enrolledToken, setEnrolledToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [showEnroll, setShowEnroll] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const lookup = useCallback(async (code: string) => {
    lockedRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/loyalty/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo buscar la tarjeta");
      // se libera el escáner unos segundos después para no repetir el mismo error en bucle
      setTimeout(() => {
        lockedRef.current = false;
      }, 2000);
      return;
    }
    setCustomer(data.customer);
    setEnrolledToken(null);
    navigator.vibrate?.(60);
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const now = Date.now();
    if (video && canvas && !lockedRef.current && now - lastScanRef.current > 150 && video.readyState === video.HAVE_ENOUGH_DATA) {
      lastScanRef.current = now;
      const scale = Math.min(1, 640 / video.videoWidth);
      const w = Math.floor(video.videoWidth * scale);
      const h = Math.floor(video.videoHeight * scale);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const result = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
        if (result?.data) lookup(result.data);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [lookup]);

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("No se pudo abrir la cámara. Revisa el permiso del navegador o escribe el código de la tarjeta.");
    }
  }

  function next() {
    setCustomer(null);
    setEnrolledToken(null);
    setMessage("");
    setError("");
    setManualCode("");
    lockedRef.current = false;
  }

  async function act(kind: "visit" | "redeem") {
    if (!customer) return;
    setBusy(true);
    setError("");
    setMessage("");
    const res = await fetch(`/api/loyalty/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: customer.id }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo completar la acción");
      return;
    }
    setCustomer(data.customer);
    setMessage(kind === "visit" ? "Visita registrada" : `Descuento canjeado: ${data.customer.redeemed}`);
    navigator.vibrate?.(100);
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) await lookup(manualCode.trim());
  }

  async function submitEnroll(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/loyalty/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, phone: newPhone }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo registrar al cliente");
      return;
    }
    lockedRef.current = true;
    setCustomer(data.customer);
    setEnrolledToken(data.cardToken);
    setMessage(data.created ? "Cliente registrado" : "Ese cliente ya estaba registrado");
    setShowEnroll(false);
    setNewName("");
    setNewPhone("");
  }

  return (
    <div className="max-w-md space-y-5">
      <Card className="overflow-hidden">
        <div className={cameraOn ? "relative bg-black" : "hidden"}>
          <video ref={videoRef} className="w-full aspect-square object-cover" playsInline muted />
          <div className="pointer-events-none absolute inset-8 border-2 border-white/70 rounded-xl" />
        </div>
        <canvas ref={canvasRef} className="hidden" />
        {!cameraOn && (
          <div className="p-6 text-center">
            <p className="text-sm text-muted mb-4">Abre la cámara y apunta al QR de la tarjeta del cliente.</p>
            <Button onClick={startCamera}>Abrir cámara</Button>
          </div>
        )}
        {cameraOn && (
          <div className="p-3 text-right">
            <Button variant="ghost" onClick={stopCamera}>
              Cerrar cámara
            </Button>
          </div>
        )}
      </Card>

      {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2">{error}</p>}
      {message && <p className="text-sm bg-sage-light text-sage rounded-md px-3 py-2">{message}</p>}

      {customer && (
        <Card className="p-5">
          <p className="font-display text-2xl font-semibold">{customer.name}</p>
          {customer.phone && <p className="text-sm text-muted">{customer.phone}</p>}

          <p className="font-display text-4xl font-semibold mt-4">
            {customer.visits} <span className="text-muted text-2xl">/ {customer.required} visitas</span>
          </p>
          <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
            {Array.from({ length: customer.required }).map((_, i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full border ${
                  i < Math.min(customer.visits, customer.required) ? "bg-ember border-ember" : "border-line"
                }`}
              />
            ))}
          </div>

          {customer.rewardAvailable && (
            <p className="text-sm font-medium bg-sage-light text-sage rounded-md px-3 py-2 mb-4">
              ¡Tiene {customer.discountText} disponible!
            </p>
          )}
          {!customer.programActive && (
            <p className="text-sm bg-marigold/10 rounded-md px-3 py-2 mb-4">El programa está pausado.</p>
          )}

          <div className="flex flex-col gap-2">
            {customer.rewardAvailable && (
              <Button onClick={() => act("redeem")} disabled={busy || !customer.programActive}>
                Canjear descuento ({customer.discountText})
              </Button>
            )}
            <Button
              variant={customer.rewardAvailable ? "secondary" : "primary"}
              onClick={() => act("visit")}
              disabled={busy || customer.visitedToday || !customer.programActive}
            >
              {customer.visitedToday ? "Ya registró su visita hoy" : "Registrar visita"}
            </Button>
            <p className="text-[11px] text-muted">Registra la visita solo si el cliente compró algo.</p>
            <Button variant="ghost" onClick={next}>
              Escanear otro cliente
            </Button>
          </div>

          {enrolledToken && (
            <div className="mt-5 pt-5 border-t border-line flex flex-col items-center gap-2">
              <p className="text-sm text-muted text-center">
                Pídele que escanee este código con la cámara de su celular para guardar su tarjeta.
              </p>
              <div className="bg-white border border-line rounded-lg p-3">
                <QrImage path={`/tarjeta/${enrolledToken}`} size={180} />
              </div>
              {customer.shortCode && (
                <p className="text-xs text-muted">
                  Código: <span className="font-mono tracking-widest text-ink">{customer.shortCode}</span>
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {!customer && (
        <>
          <Card className="p-5">
            <form onSubmit={submitManual}>
              <Field label="¿Sin cámara? Escribe el código de la tarjeta">
                <input
                  className={`${inputClass} font-mono uppercase tracking-widest`}
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="ABC234"
                  maxLength={12}
                />
              </Field>
              <Button type="submit" variant="secondary" disabled={busy || !manualCode.trim()}>
                Buscar
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            {!showEnroll ? (
              <Button variant="ghost" onClick={() => setShowEnroll(true)}>
                + Registrar cliente nuevo
              </Button>
            ) : (
              <form onSubmit={submitEnroll}>
                <Field label="Nombre">
                  <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} required />
                </Field>
                <Field label="Celular (10 dígitos)">
                  <input
                    className={inputClass}
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    inputMode="tel"
                    required
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy}>
                    Registrar
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowEnroll(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
