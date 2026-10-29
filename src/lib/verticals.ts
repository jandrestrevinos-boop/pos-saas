/**
 * Catálogo de verticales (tipos de negocio) de Tappy.
 *
 * Un solo código y un solo dominio: el tipo de negocio es configuración, no un
 * proyecto aparte. Para agregar una vertical nueva: (1) agregar el valor al enum
 * BusinessType en prisma/schema.prisma + una migración, (2) agregar su entrada aquí.
 *
 * NOTA: los roles (Administrador, Gerente, Cajero, etc.) son globales en Tappy, no por
 * empresa, así que aquí no se siembran roles. Lo que sí define cada vertical es su
 * nombre comercial, qué links del menú no aplican, las categorías iniciales y su
 * TIPOLOGÍA DE USUARIOS: qué roles se ofrecen y cómo se llaman en ese tipo de negocio
 * (ej. en Cafetería el rol COCINERO se muestra como "Barista"). Los permisos NO cambian
 * por vertical: siguen viviendo en src/lib/permissions.ts.
 */

/** Roles de empresa (los que un negocio puede asignar a su equipo). */
export const COMPANY_ROLE_NAMES = ["ADMIN_EMPRESA", "GERENTE", "CAJERO", "MESERO", "COCINERO"] as const;
export type CompanyRoleName = (typeof COMPANY_ROLE_NAMES)[number];

/** Nombre por defecto de cada rol, cuando la vertical no lo renombra. */
export const BASE_ROLE_LABELS: Record<CompanyRoleName, string> = {
  ADMIN_EMPRESA: "Administrador",
  GERENTE: "Gerente",
  CAJERO: "Cajero",
  MESERO: "Mesero",
  COCINERO: "Cocinero",
};

export const BUSINESS_TYPES = ["RESTAURANTE", "CAFETERIA", "ESCUELA", "DISTRIBUIDOR", "LABORATORIO", "BARBERIA_ESTETICA"] as const;
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
  /** Tipología de usuarios: roles que este tipo de negocio puede asignar a su equipo. */
  userTypes: CompanyRoleName[];
  /** Renombres de rol propios de la vertical (el resto usa BASE_ROLE_LABELS). */
  roleLabels: Partial<Record<CompanyRoleName, string>>;
  /** Cómo se llama la pantalla de comandas (menú y encabezado). */
  kitchenLabel: string;
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
    userTypes: [...COMPANY_ROLE_NAMES],
    roleLabels: {},
    kitchenLabel: "Cocina",
  },
  CAFETERIA: {
    key: "CAFETERIA",
    label: "Cafetería",
    productName: "Tappy Cafeterías",
    workspaceName: "Mi Cafetería",
    status: "live",
    hiddenNavHrefs: [],
    defaultCategories: ["Bebidas calientes", "Bebidas frías", "Alimentos", "Postres"],
    userTypes: [...COMPANY_ROLE_NAMES],
    // En una cafetería quien prepara las órdenes es el barista, no un cocinero.
    roleLabels: { COCINERO: "Barista" },
    kitchenLabel: "Barra",
  },
  ESCUELA: {
    key: "ESCUELA",
    label: "Escuela",
    productName: "Tappy Escuelas",
    workspaceName: "Mi Escuela",
    status: "planned",
    hiddenNavHrefs: [],
    defaultCategories: ["Desayunos", "Comidas", "Snacks", "Bebidas"],
    userTypes: [...COMPANY_ROLE_NAMES],
    roleLabels: {},
    kitchenLabel: "Cocina",
  },
  DISTRIBUIDOR: {
    key: "DISTRIBUIDOR",
    label: "Distribuidor",
    productName: "Tappy Distribuidores",
    workspaceName: "Mi Distribuidora",
    status: "planned",
    hiddenNavHrefs: ["/kitchen", "/tables"],
    defaultCategories: [],
    userTypes: [...COMPANY_ROLE_NAMES],
    roleLabels: {},
    kitchenLabel: "Cocina",
  },
  LABORATORIO: {
    key: "LABORATORIO",
    label: "Laboratorio / clínica",
    productName: "Tappy Laboratorios",
    workspaceName: "Mi Laboratorio",
    status: "planned",
    hiddenNavHrefs: ["/kitchen", "/tables"],
    defaultCategories: [],
    userTypes: [...COMPANY_ROLE_NAMES],
    roleLabels: {},
    kitchenLabel: "Cocina",
  },
  BARBERIA_ESTETICA: {
    key: "BARBERIA_ESTETICA",
    label: "Barbería / estética",
    productName: "Tappy Barberías y Estéticas",
    workspaceName: "Mi Salón",
    status: "planned",
    hiddenNavHrefs: ["/kitchen", "/tables"],
    // Los servicios se cobran como productos en el POS.
    defaultCategories: ["Cortes", "Barba", "Color y tintes", "Tratamientos", "Productos"],
    userTypes: [...COMPANY_ROLE_NAMES],
    roleLabels: {},
    kitchenLabel: "Cocina",
  },
};

export function getVertical(type: string | null | undefined): VerticalDef {
  return VERTICALS[(type as BusinessTypeKey) ?? "RESTAURANTE"] ?? VERTICALS.RESTAURANTE;
}

/** Nombre del rol tal como lo ve este tipo de negocio (ej. COCINERO -> "Barista" en Cafetería). */
export function getRoleLabel(type: string | null | undefined, roleName: string): string {
  const v = getVertical(type);
  return v.roleLabels[roleName as CompanyRoleName] ?? BASE_ROLE_LABELS[roleName as CompanyRoleName] ?? roleName;
}

/** Roles que este tipo de negocio puede asignar. Nunca incluye SUPER_ADMIN. */
export function getAllowedRoleNames(type: string | null | undefined): CompanyRoleName[] {
  return getVertical(type).userTypes;
}

/** Texto para el selector de Super Admin, ej. "Escuela (en desarrollo)". */
export function verticalOptionLabel(v: VerticalDef): string {
  return v.status === "planned" ? `${v.label} (en desarrollo)` : v.label;
}
