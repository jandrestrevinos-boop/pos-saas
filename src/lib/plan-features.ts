/**
 * Catálogo compartido de features editables por plan. No incluye
 * sucursales/usuarios/cajas — esos se editan como números aparte y se
 * renderizan dinámicamente en buildDisplayFeatures(). Usado tanto en el
 * editor de planes (/plataforma/plans) como en la vista de features por
 * empresa (/plataforma/companies).
 */
export const FEATURE_CATALOG = [
  "Menús por turno/hora",
  "Gestión de mesas",
  "Comandas digitales para cocina",
  "Automatizaciones avanzadas",
  "Integración con delivery (Uber Eats, DoorDash, Rappi)",
  "WhatsApp Business",
  "Pagos integrados (tarjetas desde el POS)",
  "API básica",
  "Conexión con Contpaq/SAT",
  "Dashboard avanzado (15+ gráficos)",
  "Control de acceso por rol",
  "Auditoría de cajas",
  "Soporte prioritario (4h)",
  "Inventario compartido entre sucursales",
  "Transferencias automáticas entre sucursales",
  "Costeo por receta",
  "Dashboard empresarial (30+ métricas)",
  "Reportes consolidados",
  "Proyecciones con IA básica",
  "Auditoría avanzada",
  "Multi-moneda",
  "Soporte 24/7 con gestor de cuenta dedicado",
] as const;
