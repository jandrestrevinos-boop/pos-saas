"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Dibuja un QR. Pasa `path` (ej. "/tarjeta/abc") para que el QR contenga la URL
 * absoluta del sitio actual, o `value` para un texto cualquiera.
 */
export function QrImage({
  path,
  value,
  size = 224,
  className,
}: {
  path?: string;
  value?: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    const content = value ?? (path ? `${window.location.origin}${path}` : "");
    if (!content) return;
    let cancelled = false;
    QRCode.toDataURL(content, { width: size * 2, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path, value, size]);

  if (!src) return <div style={{ width: size, height: size }} className={className} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="Código QR" className={className} />;
}

/** Descarga el QR como PNG grande (para imprimir el QR del mostrador). */
export async function downloadQrPng(path: string, filename: string) {
  const url = await QRCode.toDataURL(`${window.location.origin}${path}`, {
    width: 1000,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
