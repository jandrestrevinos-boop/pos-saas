/**
 * Limitador simple en memoria para endpoints públicos (registro de clientes).
 * Por instancia del servidor: en serverless no es una garantía global, pero
 * frena el abuso casual (spam de registros desde un mismo IP/QR). Si algún día
 * se necesita algo estricto, se cambia por Redis/Upstash sin tocar a quien lo usa.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    // limpieza ocasional para que el Map no crezca sin límite
    if (hits.size > 5000) {
      hits.forEach((v, k) => {
        if (v.resetAt <= now) hits.delete(k);
      });
    }
    return true;
  }

  entry.count += 1;
  return entry.count <= max;
}
