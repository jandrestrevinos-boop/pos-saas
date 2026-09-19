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
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Matriz por defecto usada únicamente en el seed inicial. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS), // todo, incluido COMPANIES_MANAGE
  ADMIN_EMPRESA: [
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
  ],
  GERENTE: [
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
    PERMISSIONS.TABLES_MANAGE,
  ],
  CAJERO: [
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.CASH_OPEN,
    PERMISSIONS.CASH_CLOSE,
    PERMISSIONS.CASH_MOVEMENT,
    PERMISSIONS.TABLES_MANAGE,
  ],
  MESERO: [PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_VIEW, PERMISSIONS.TABLES_MANAGE],
};

export function hasPermission(
  userPermissions: string[],
  required: PermissionKey
): boolean {
  return userPermissions.includes(required);
}
