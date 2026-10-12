import { del } from "@vercel/blob";

/** La URL es de nuestro almacenamiento Blob Y está dentro de la carpeta de esta empresa. */
export function isCompanyBlobUrl(url: string, companyId: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com") && u.pathname.startsWith(`/${companyId}/`);
  } catch {
    return false;
  }
}

/** Borra una imagen vieja; si falla no pasa nada (solo queda un archivo huérfano). */
export async function deleteBlobQuiet(url: string): Promise<void> {
  try {
    await del(url);
  } catch (e) {
    console.error("No se pudo borrar la imagen anterior", e);
  }
}
