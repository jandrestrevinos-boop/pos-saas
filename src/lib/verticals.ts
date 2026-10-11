/**
 * Catálogo de verticales (tipos de negocio) de Tappy.
 *
 * Un solo código y un solo dominio: el tipo de negocio es configuración, no un
 * proyecto aparte. Para agregar una vertical nueva: (1) agregar el valor al enum
 * BusinessType en prisma/schema.prisma + una migración, (2) agregar su entrada aquí.
 *
 * NOTA: los roles (Administrador, Gerente, Cajero, etc.) son globales en Tappy, no por
 * empresa, así que aquí no se siembran roles. Lo que sí define cada vertical es su
 * nombre comercial, qué links del menú no aplican y las categorías iniciales.
 */

export const BUSINESS_TYPES = ["RESTAURANTE", "CAFETERIA", "ESCUELA", "DISTRIBUIDOR", "LABORATORIO"] as const;
export type BusinessTypeKey = (typeof BUSINESS_TYPES)[number];

export interface VerticalDef {
  key: BusinessTypeKey;
  /** Nombre corto del tipo, para tablas y selectores. */
  label: string;
  /** Marca comercial de la vertical. */
  productName: string;
  /** Nombre que ve el cliente arriba en su menú lateral. */
  workspaceName: string;
  /** "live" = ya opera con sus módulos propios; "planned" = hoy usa el POS base, módulos en desarrollo. */
  status: "live" | "planned";
  /** Links del menú lateral que NO aplican a este tipo de negocio. */
  hiddenNavHrefs: string[];
  /** Categorías iniciales al crear la empresa (vacío = no se siembra nada). */
  defaultCategories: string[];
}

export const VERTICALS: Record<BusinessTypeKey, VerticalDef> = {
  RESTAURANTE: {
    key: "RESTAURANTE",
    label: "Restaurante",
    productName: "Tappy Restaurantes",
    workspaceName: "Mi Restaurante",
    status: "live",
    hiddenNavHrefs: [],
    defaultCategories: [],
  },
  CAFETERIA: {
    key: "CAFETERIA",
    label: "Cafetería",
    productName: "Tappy Cafeterías",
    workspaceName: "Mi Cafetería",
    status: "live",
    hiddenNavHrefs: [],
    defaultCategories: ["Bebidas calientes", "Bebidas frías", "Alimentos", "Postres"],
  },
  ESCUELA: {
    key: "ESCUELA",
    label: "Escuela",
    productName: "Tappy Escuelas",
    workspaceName: "Mi Escuela",
    status: "planned",
    hiddenNavHrefs: [],
    defaultCategories: ["Desayunos", "Comidas", "Snacks", "Bebidas"],
  },
  DISTRIBUIDOR: {
    key: "DISTRIBUIDOR",
    label: "Distribuidor",
    productName: "Tappy Distribuidores",
    workspaceName: "Mi Distribuidora",
    status: "planned",
    hiddenNavHrefs: ["/kitchen", "/tables"],
    defaultCategories: [],
  },
  LABORATORIO: {
    key: "LABORATORIO",
    label: "Laboratorio / clínica",
    productName: "Tappy Laboratorios",
    workspaceName: "Mi Laboratorio",
    status: "planned",
    hiddenNavHrefs: ["/kitchen", "/tables"],
    defaultCategories: [],
  },
};

export function getVertical(type: string | null | undefined): VerticalDef {
  return VERTICALS[(type as BusinessTypeKey) ?? "RESTAURANTE"] ?? VERTICALS.RESTAURANTE;
}

/** Texto para el selector de Super Admin, ej. "Escuela (en desarrollo)". */
export function verticalOptionLabel(v: VerticalDef): string {
  return v.status === "planned" ? `${v.label} (en desarrollo)` : v.label;
}
