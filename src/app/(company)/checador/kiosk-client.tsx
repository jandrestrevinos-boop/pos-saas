"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { CONSENT_TEXT } from "@/lib/attendance";

type Result = { kind: "IN" | "OUT"; employeeName: string; punchedAt: string; sessionMinutes: number | null };
type Field = "code" | "pin";

const RESULT_SECONDS = 6;

function formatDuration(minutes: number) {
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

export function KioskClient({ requirePhoto, timezone }: { requirePhoto: boolean; timezone: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photoRef = useRef<Blob | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [active, setActive] = useState<Field>("code");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [consentFor, setConsentFor] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Reloj en pantalla (solo para que el empleado vea la hora; el registro usa la hora del servidor).
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setCameraOn(true);
    } catch {
      setCameraError("No se pudo abrir la cámara. Permite el acceso en el navegador para poder checar con foto.");
    }
  }, []);

  useEffect(() => {
    if (requirePhoto) startCamera();
    return stopCamera;
  }, [requirePhoto, startCamera, stopCamera]);

  // La pantalla de resultado se cierra sola.
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), RESULT_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [result]);

  function capturePhoto(): Promise<Blob | null> {
    const video = videoRef.current;
    if (!video || !cameraOn || video.videoWidth === 0) return Promise.resolve(null);
    const scale = Math.min(1, 480 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7));
  }

  function press(digit: string) {
    setError("");
    if (active === "code") setCode((c) => (c + digit).slice(0, 6));
    else setPin((p) => (p + digit).slice(0, 6));
  }

  function backspace() {
    setError("");
    if (active === "code") setCode((c) => c.slice(0, -1));
    else setPin((p) => p.slice(0, -1));
  }

  function reset() {
    setCode("");
    setPin("");
    setActive("code");
    setConsentFor(null);
    setConsentChecked(false);
    photoRef.current = null;
  }

  async function submit(acceptConsent: boolean) {
    setBusy(true);
    setError("");

    // La foto se toma una sola vez por intento (si hay que aceptar el aviso, se reutiliza).
    if (!photoRef.current) photoRef.current = await capturePhoto();

    const form = new FormData();
    form.set("code", code);
    form.set("pin", pin);
    if (acceptConsent) form.set("acceptConsent", "1");
    if (photoRef.current) form.set("photo", photoRef.current, "checada.jpg");

    try {
      const res = await fetch("/api/attendance/punch", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo registrar la marca");
        setPin("");
        setActive("pin");
        photoRef.current = null;
        return;
      }
      if (data.needsConsent) {
        setConsentFor(data.employeeName);
        return;
      }
      navigator.vibrate?.(100);
      setResult(data as Result);
      reset();
    } catch {
      setError("Sin conexión. Revisa el internet e intenta de nuevo.");
      photoRef.current = null;
    } finally {
      setBusy(false);
    }
  }

  // Computadora: también se puede teclear (números, borrar y Enter).
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (result || consentFor || busy) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === "Backspace") backspace();
    else if (e.key === "Enter") {
      if (active === "code" && code) setActive("pin");
      else if (code.length > 0 && pin.length >= 4 && (!requirePhoto || cameraOn)) submit(false);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const canSubmit = code.length > 0 && pin.length >= 4 && !busy && (!requirePhoto || cameraOn);
  const clock = new Intl.DateTimeFormat("es-MX", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now);
  const dateText = new Intl.DateTimeFormat("es-MX", { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }).format(now);

  // ── Resultado ───────────────────────────────────────────────────────
  if (result) {
    const isIn = result.kind === "IN";
    const time = new Intl.DateTimeFormat("es-MX", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(result.punchedAt));
    return (
      <Card className={`max-w-xl mx-auto p-8 text-center ${isIn ? "border-sage/40 bg-sage-light" : "border-marigold/40 bg-marigold/10"}`}>
        <p className="text-5xl mb-3">{isIn ? "✅" : "👋"}</p>
        <p className="font-display text-3xl font-semibold">{isIn ? "Entrada registrada" : "Salida registrada"}</p>
        <p className="text-xl mt-2">{result.employeeName}</p>
        <p className="font-display text-5xl font-semibold mt-4">{time}</p>
        {result.sessionMinutes !== null && (
          <p className="text-muted mt-3">Tiempo de esta jornada: {formatDuration(result.sessionMinutes)}</p>
        )}
        <Button className="mt-6" variant="secondary" onClick={() => setResult(null)}>
          Listo
        </Button>
      </Card>
    );
  }

  // ── Aviso / aceptación (primera vez) ────────────────────────────────
  if (consentFor) {
    return (
      <Card className="max-w-xl mx-auto p-6">
        <p className="text-sm text-muted mb-1">Hola, {consentFor}</p>
        <h2 className="font-display text-xl font-semibold mb-3">Antes de checar por primera vez</h2>
        <div className="max-h-72 overflow-y-auto rounded-md border border-line bg-paper p-4 text-sm whitespace-pre-line">{CONSENT_TEXT}</div>
        <label className="flex items-start gap-3 mt-4 text-sm">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} />
          <span>He leído el aviso y acepto que mi asistencia se registre con mi número de empleado, PIN y fotografía.</span>
        </label>
        {error && <p className="text-sm text-ember-dark mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <Button disabled={!consentChecked || busy} onClick={() => submit(true)}>
            {busy ? "Registrando..." : "Aceptar y checar"}
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              reset();
              setError("");
            }}
          >
            Cancelar
          </Button>
        </div>
      </Card>
    );
  }

  // ── Teclado ─────────────────────────────────────────────────────────
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="max-w-3xl mx-auto grid gap-6 md:grid-cols-2">
      <div>
        <Card className="p-4 text-center mb-4">
          <p className="font-display text-5xl font-semibold tabular-nums">{clock}</p>
          <p className="text-sm text-muted capitalize mt-1">{dateText}</p>
        </Card>

        {requirePhoto && (
          <Card className="overflow-hidden relative aspect-[4/3] bg-black/80">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover -scale-x-100" />
            {!cameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-white text-sm">
                <p>{cameraError || "Abriendo cámara..."}</p>
                {cameraError && (
                  <Button variant="secondary" onClick={startCamera}>
                    Reintentar
                  </Button>
                )}
              </div>
            )}
          </Card>
        )}
        {requirePhoto && <p className="text-xs text-muted mt-2 text-center">Se toma una foto al checar para comprobar tu asistencia.</p>}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 mb-4">
          {(["code", "pin"] as Field[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActive(f)}
              className={`rounded-md border px-4 py-3 text-left ${active === f ? "border-ember bg-white" : "border-line bg-paper"}`}
            >
              <span className="block text-xs uppercase tracking-wide text-muted">{f === "code" ? "Número de empleado" : "PIN"}</span>
              <span className="block font-display text-2xl tracking-widest min-h-[2rem]">
                {f === "code" ? code || "—" : pin ? "•".repeat(pin.length) : "—"}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {keys.map((k) => (
            <button key={k} type="button" onClick={() => press(k)} className="h-14 rounded-md border border-line bg-white text-xl font-medium active:bg-paper">
              {k}
            </button>
          ))}
          <button type="button" onClick={backspace} className="h-14 rounded-md border border-line bg-white text-xl active:bg-paper" aria-label="Borrar">
            ⌫
          </button>
          <button type="button" onClick={() => press("0")} className="h-14 rounded-md border border-line bg-white text-xl font-medium active:bg-paper">
            0
          </button>
          <button
            type="button"
            onClick={() => {
              setError("");
              if (active === "code" && code) setActive("pin");
            }}
            className="h-14 rounded-md border border-line bg-white text-sm font-medium active:bg-paper"
          >
            Siguiente
          </button>
        </div>

        {error && <p className="text-sm text-ember-dark mt-3" role="alert">{error}</p>}
        <Button className="w-full mt-4 h-14 text-base" disabled={!canSubmit} onClick={() => submit(false)}>
          {busy ? "Registrando..." : "Checar"}
        </Button>
      </Card>
    </div>
  );
}
