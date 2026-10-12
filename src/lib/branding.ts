// Marca por empresa: tipos, catálogo de tipografías y utilidades de color.
// Sin dependencias de servidor: lo usan tanto el servidor como el navegador.

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const FONT_KEYS = [
  "inter",
  "poppins",
  "montserrat",
  "nunito",
  "dm-sans",
  "roboto",
  "lato",
  "fraunces",
  "playfair",
  "merriweather",
  "lora",
  "bebas",
] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const FONTS: Record<FontKey, { label: string; css: string; google: string }> = {
  inter: { label: "Inter", css: '"Inter", -apple-system, sans-serif', google: "Inter:wght@400;500;600;700" },
  poppins: { label: "Poppins", css: '"Poppins", sans-serif', google: "Poppins:wght@400;500;600;700" },
  montserrat: { label: "Montserrat", css: '"Montserrat", sans-serif', google: "Montserrat:wght@400;500;600;700" },
  nunito: { label: "Nunito", css: '"Nunito", sans-serif', google: "Nunito:wght@400;500;600;700" },
  "dm-sans": { label: "DM Sans", css: '"DM Sans", sans-serif', google: "DM+Sans:wght@400;500;600;700" },
  roboto: { label: "Roboto", css: '"Roboto", sans-serif', google: "Roboto:wght@400;500;700" },
  lato: { label: "Lato", css: '"Lato", sans-serif', google: "Lato:wght@400;700" },
  fraunces: { label: "Fraunces (elegante)", css: '"Fraunces", serif', google: "Fraunces:wght@400;600;700" },
  playfair: { label: "Playfair Display (elegante)", css: '"Playfair Display", serif', google: "Playfair+Display:wght@400;600;700" },
  merriweather: { label: "Merriweather (clásica)", css: '"Merriweather", serif', google: "Merriweather:wght@400;700" },
  lora: { label: "Lora (clásica)", css: '"Lora", serif', google: "Lora:wght@400;600;700" },
  bebas: { label: "Bebas Neue (llamativa)", css: '"Bebas Neue", sans-serif', google: "Bebas+Neue" },
};

export const FONT_SCALES = {
  sm: { label: "Pequeño", px: "14px" },
  md: { label: "Normal", px: "16px" },
  lg: { label: "Grande", px: "18px" },
} as const;
export type FontScale = keyof typeof FONT_SCALES;

export interface Branding {
  brandName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  sidebarColor: string | null;
  fontBody: string | null;
  fontDisplay: string | null;
  fontScale: string | null;
  showProductImages: boolean;
}

export const EMPTY_BRANDING: Branding = {
  brandName: null,
  logoUrl: null,
  primaryColor: null,
  accentColor: null,
  sidebarColor: null,
  fontBody: null,
  fontDisplay: null,
  fontScale: null,
  showProductImages: false,
};

// Valores originales de Tappy (lo que se ve cuando la empresa no personaliza nada).
export const DEFAULT_COLORS = { primary: "#0038FF", accent: "#00B4D8", sidebar: "#0A0F2E" };
const DEFAULT_FONT_BODY = FONTS.inter.css;
const DEFAULT_FONT_DISPLAY = FONTS.fraunces.css;

export const PRESETS: { name: string; primary: string; accent: string; sidebar: string }[] = [
  { name: "Azul Tappy", primary: "#0038FF", accent: "#00B4D8", sidebar: "#0A0F2E" },
  { name: "Rojo taquería", primary: "#D62828", accent: "#F77F00", sidebar: "#1F1111" },
  { name: "Verde fresco", primary: "#2D6A4F", accent: "#95D5B2", sidebar: "#0B1F17" },
  { name: "Naranja café", primary: "#C2410C", accent: "#F59E0B", sidebar: "#1C1410" },
  { name: "Morado", primary: "#6D28D9", accent: "#EC4899", sidebar: "#1B1033" },
  { name: "Negro elegante", primary: "#111827", accent: "#D4A017", sidebar: "#0B0B0B" },
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const triplet = (hex: string) => hexToRgb(hex).join(" ");

function mix(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste del color contra texto blanco (WCAG): 1 a 21. */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

/** El texto de botones y menú es blanco: los colores muy claros lo vuelven ilegible. */
export function validateBrandColors(b: Pick<Branding, "primaryColor" | "sidebarColor">): string | null {
  if (b.primaryColor && contrastWithWhite(b.primaryColor) < 3) {
    return "El color principal es muy claro: el texto blanco de los botones no se leería. Elige uno más oscuro.";
  }
  if (b.sidebarColor && contrastWithWhite(b.sidebarColor) < 4.5) {
    return "El color del menú lateral es muy claro: el texto blanco no se leería. Elige uno más oscuro.";
  }
  return null;
}

/**
 * Variables CSS de la marca. Con `withDefaults` devuelve siempre todas (para la vista previa en vivo,
 * que debe poder volver al look original); sin él, solo las que la empresa personalizó.
 */
export function cssVarMap(b: Branding, withDefaults: boolean): Record<string, string> {
  const v: Record<string, string> = {};
  const primary = b.primaryColor && HEX_RE.test(b.primaryColor) ? b.primaryColor : withDefaults ? DEFAULT_COLORS.primary : null;
  const accent = b.accentColor && HEX_RE.test(b.accentColor) ? b.accentColor : withDefaults ? DEFAULT_COLORS.accent : null;
  const sidebar = b.sidebarColor && HEX_RE.test(b.sidebarColor) ? b.sidebarColor : withDefaults ? DEFAULT_COLORS.sidebar : null;

  if (primary) {
    v["--ember-rgb"] = triplet(primary);
    v["--ember-dark-rgb"] = triplet(mix(primary, "#000000", 0.25));
  }
  if (accent) v["--marigold-rgb"] = triplet(accent);
  if (sidebar) {
    v["--ink-950-rgb"] = triplet(sidebar);
    v["--ink-line-rgb"] = triplet(mix(sidebar, "#ffffff", 0.12));
  }

  const body = b.fontBody && b.fontBody in FONTS ? FONTS[b.fontBody as FontKey].css : withDefaults ? DEFAULT_FONT_BODY : null;
  const display =
    b.fontDisplay && b.fontDisplay in FONTS ? FONTS[b.fontDisplay as FontKey].css : withDefaults ? DEFAULT_FONT_DISPLAY : null;
  if (body) v["--font-body"] = body;
  if (display) v["--font-display"] = display;
  return v;
}

export function fontPx(scale: string | null): string | null {
  return scale && scale in FONT_SCALES ? FONT_SCALES[scale as FontScale].px : null;
}

/** CSS que se inyecta en el layout de la empresa. Todo viene de valores validados (hex / catálogo fijo). */
export function buildBrandingCss(b: Branding): string {
  const vars = Object.entries(cssVarMap(b, false)).map(([k, val]) => `${k}:${val}`);
  const px = fontPx(b.fontScale);
  return (vars.length ? `:root{${vars.join(";")}}` : "") + (px ? `html{font-size:${px}}` : "");
}

/** URL de Google Fonts para las tipografías elegidas (null si no eligió ninguna). */
export function googleFontsHref(b: Pick<Branding, "fontBody" | "fontDisplay">): string | null {
  const keys = [...new Set([b.fontBody, b.fontDisplay])].filter((k): k is string => !!k && k in FONTS);
  if (keys.length === 0) return null;
  const families = keys.map((k) => `family=${FONTS[k as FontKey].google}`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
