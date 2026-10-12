import { buildBrandingCss, googleFontsHref, type Branding } from "@/lib/branding";

/**
 * Inyecta los colores/tipografías/tamaño de letra de la empresa. Se renderiza en el servidor,
 * así no hay parpadeo al cargar. Si la empresa no personalizó nada, no emite nada.
 */
export function BrandingStyle({ branding }: { branding: Branding }) {
  const css = buildBrandingCss(branding);
  const fontsHref = googleFontsHref(branding);
  if (!css && !fontsHref) return null;
  return (
    <>
      {fontsHref && <link rel="stylesheet" href={fontsHref} />}
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
    </>
  );
}
