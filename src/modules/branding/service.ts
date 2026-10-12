import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { EMPTY_BRANDING, FONTS, HEX_RE, validateBrandColors, type Branding } from "@/lib/branding";
import { deleteBlobQuiet, isCompanyBlobUrl } from "@/lib/blob";

const hex = z.string().regex(HEX_RE, "Color inválido").nullable();
const fontKey = z
  .string()
  .refine((v) => v in FONTS, "Tipografía no disponible")
  .nullable();

export const brandingSchema = z.object({
  brandName: z.string().trim().max(40, "El nombre es muy largo (máximo 40 caracteres)").nullable(),
  logoUrl: z.string().max(600).nullable(),
  primaryColor: hex,
  accentColor: hex,
  sidebarColor: hex,
  fontBody: fontKey,
  fontDisplay: fontKey,
  fontScale: z.enum(["sm", "md", "lg"]).nullable(),
  showProductImages: z.boolean(),
});

export const brandingService = {
  /**
   * Nunca lanza error: si la tabla aún no existe (migración pendiente) o falla la consulta,
   * la plataforma se ve con la marca original en vez de romperse.
   */
  async get(companyId: string): Promise<Branding> {
    try {
      const row = await prisma.companyBranding.findUnique({ where: { companyId } });
      if (!row) return EMPTY_BRANDING;
      return {
        brandName: row.brandName,
        logoUrl: row.logoUrl,
        primaryColor: row.primaryColor,
        accentColor: row.accentColor,
        sidebarColor: row.sidebarColor,
        fontBody: row.fontBody,
        fontDisplay: row.fontDisplay,
        fontScale: row.fontScale,
        showProductImages: row.showProductImages,
      };
    } catch (e) {
      console.error("No se pudo leer la marca de la empresa", e);
      return EMPTY_BRANDING;
    }
  },

  async save(companyId: string, userId: string, input: z.infer<typeof brandingSchema>): Promise<Branding> {
    const colorError = validateBrandColors(input);
    if (colorError) throw new Error(colorError);

    const prev = await brandingService.get(companyId);
    if (input.logoUrl && input.logoUrl !== prev.logoUrl && !isCompanyBlobUrl(input.logoUrl, companyId)) {
      throw new Error("Logo inválido");
    }

    const data = {
      brandName: input.brandName && input.brandName.length > 0 ? input.brandName : null,
      logoUrl: input.logoUrl,
      primaryColor: input.primaryColor,
      accentColor: input.accentColor,
      sidebarColor: input.sidebarColor,
      fontBody: input.fontBody,
      fontDisplay: input.fontDisplay,
      fontScale: input.fontScale,
      showProductImages: input.showProductImages,
    };

    await prisma.companyBranding.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });

    if (prev.logoUrl && prev.logoUrl !== data.logoUrl) await deleteBlobQuiet(prev.logoUrl);

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entity: "CompanyBranding",
        newData: {
          brandName: data.brandName,
          primaryColor: data.primaryColor,
          accentColor: data.accentColor,
          sidebarColor: data.sidebarColor,
          fontBody: data.fontBody,
          fontDisplay: data.fontDisplay,
          fontScale: data.fontScale,
          showProductImages: data.showProductImages,
          hasLogo: data.logoUrl !== null,
        },
      },
    });

    return { ...data };
  },
};
