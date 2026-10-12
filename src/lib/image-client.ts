/**
 * Reduce y comprime una imagen en el navegador antes de subirla (las fotos del celular
 * pesan varios MB). Logo: PNG (conserva transparencia). Foto de producto: JPEG.
 */
export async function compressImage(file: File, kind: "logo" | "product"): Promise<File> {
  const maxSide = kind === "logo" ? 512 : 900;
  const outType = kind === "logo" ? "image/png" : "image/jpeg";

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("No se pudo leer la imagen. Prueba con un JPG o PNG."));
      el.src = url;
    });

    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Tu navegador no puede procesar la imagen.");
    if (outType === "image/jpeg") {
      ctx.fillStyle = "#ffffff"; // JPEG no tiene transparencia
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outType, 0.82));
    if (!blob) throw new Error("No se pudo comprimir la imagen.");
    const ext = outType === "image/png" ? "png" : "jpg";
    return new File([blob], `${kind}.${ext}`, { type: outType });
  } finally {
    URL.revokeObjectURL(url);
  }
}
