/**
 * Catálogo central de permisos. Cada Role tiene un subconjunto de estos
 * permisos (tabla RolePermission). Los componentes y API routes deben
 * validar contra este catálogo, nunca contra el nombre del rol directamente,
 * para poder soportar roles personalizados en el futuro.
 */
export const PERMISSIONS = {
  COMPANIES_MANAGE: "companies.manage", // solo SUPER_ADMIN
  BRANCHES_MANAGE: "branches.manage",
  USERS_MANAGE: "users.manage",
  PRODUCTS_MANAGE: "products.manage",
  CATEGORIES_MANAGE: "categories.manage",
  SALES_CREATE: "sales.create",
  SALES_VIEW: "sales.view",
  SALES_CANCEL: "sales.cancel",
  CASH_OPEN: "cash.open",
  CASH_CLOSE: "cash.close",
  CASH_MOVEMENT: "cash.movement",
  INVENTORY_MANAGE: "inventory.manage",
  REPORTS_VIEW: "reports.view",
  SETTINGS_MANAGE: "settings.manage",
  HARDWARE_FINANCING_MANAGE: "hardware_financing.manage", // solo SUPER_ADMIN: crear/liquidar/reestructurar financiamientos
  TABLES_MANAGE: "tables.manage", // requiere además la feature de plan "gestion_mesas" — ver hasFeature()
  KITCHEN_VIEW: "kitchen.view", // ver/avanzar comandas en la Pantalla de Cocina
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Matriz por defecto usada en el seed. Se puede re-correr (`npm run
 * prisma:seed`) sin miedo: el seed hace upsert de permisos por rol, nunca
 * quita los que ya no aparecen aquí, así que ampliar un rol es seguro.
 *
 * Roles (acordado con Jose, Sept 2026):
 * - Administrador (ADMIN_EMPRESA) y Gerente: mismos permisos, acceso general.
 * - Mesero y Cajero: mismos permisos, solo vender (POS + caja + mesas), sin
 *   reportes ni dashboard.
 * - Cocinero: solo Pantalla de Cocina.
 */
const ADMIN_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.BRANCHES_MANAGE,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.PRODUCTS_MANAGE,
  PERMISSIONS.CATEGORIES_MANAGE,
  PERMISSIONS.SALES_CREATE,
  PERMISSIONS.SALES_VIEW,
  PERMISSIONS.SALES_CANCEL,
  PERMISSIONS.CASH_OPEN,
  PERMISSIONS.CASH_CLOSE,
  PERMISSIONS.CASH_MOVEMENT,
  PERMISSIONS.INVENTORY_MANAGE,
  PERMISSIONS.REPORTS_VIEW,
  PERMISSIONS.SETTINGS_MANAGE,
  PERMISSIONS.TABLES_MANAGE,
  PERMISSIONS.KITCHEN_VIEW,
];

const VENTAS_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.SALES_CREATE,
  PERMISSIONS.SALES_VIEW,
  PERMISSIONS.CASH_OPEN,
  PERMISSIONS.CASH_CLOSE,
  PERMISSIONS.CASH_MOVEMENT,
  PERMISSIONS.TABLES_MANAGE,
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS), // todo, incluido COMPANIES_MANAGE
  ADMIN_EMPRESA: ADMIN_PERMISSIONS,
  GERENTE: ADMIN_PERMISSIONS,
  CAJERO: VENTAS_PERMISSIONS,
  MESERO: VENTAS_PERMISSIONS,
  COCINERO: [PERMISSIONS.KITCHEN_VIEW],
};

export function hasPermission(
  userPermissions: string[],
  required: PermissionKey
): boolean {
  return userPermissions.includes(required);
}

/**
 * A dónde mandar a alguien que intentó entrar a una página para la que no
 * tiene permiso. No siempre puede ser "/dashboard" — un Cocinero no tiene
 * REPORTS_VIEW, así que caería en un loop de redirección si esa fuera la
 * meta fija. Cada página gateada debe usar esto en vez de un href fijo.
 */
export function getHomeRoute(userPermissions: string[]): string {
  if (hasPermission(userPermissions, PERMISSIONS.REPORTS_VIEW)) return "/dashboard";
  if (hasPermission(userPermissions, PERMISSIONS.SALES_CREATE)) return "/pos";
  if (hasPermission(userPermissions, PERMISSIONS.KITCHEN_VIEW)) return "/kitchen";
  return "/login";
}
