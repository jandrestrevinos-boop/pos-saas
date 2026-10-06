"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * Cámara que lee códigos QR. Llama a `onCode` con el texto leído. Mientras `paused` sea true
 * (por ejemplo, ya se está buscando al cliente) no vuelve a leer.
 */
export function QrScanner({ onCode, paused = false }: { onCode: (code: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const lastScanRef = useRef(0);
  const pausedRef = useRef(paused);
  const onCodeRef = useRef(onCode);
  const [on, setOn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOn(false);
  }, []);

  useEffect(() => stop, [stop]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const now = Date.now();
    if (video && canvas && !pausedRef.current && now - lastScanRef.current > 150 && video.readyState === video.HAVE_ENOUGH_DATA) {
      lastScanRef.current = now;
      const scale = Math.min(1, 640 / video.videoWidth);
      const w = Math.floor(video.videoWidth * scale);
      const h = Math.floor(video.videoHeight * scale);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        const result = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
        if (result?.data) onCodeRef.current(result.data);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setOn(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("No se pudo abrir la cámara. Revisa el permiso o escribe el código de la tarjeta.");
    }
  }

  return (
    <div>
      <div className={on ? "relative bg-black rounded-lg overflow-hidden" : "hidden"}>
        <video ref={videoRef} className="w-full aspect-square object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-8 border-2 border-white/70 rounded-xl" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {on ? (
        <button type="button" onClick={stop} className="mt-2 text-xs text-muted underline">
          Cerrar cámara
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          className="w-full rounded-md border border-line py-2.5 text-sm font-medium"
        >
          Abrir cámara
        </button>
      )}
      {error && <p className="text-xs text-ember-dark mt-2">{error}</p>}
    </div>
  );
}
