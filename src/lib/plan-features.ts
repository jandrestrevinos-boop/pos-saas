/**
 * Catálogo central de features editables por plan. No incluye
 * sucursales/usuarios/cajas — esos se editan como números aparte y se
 * renderizan dinámicamente en buildDisplayFeatures(). Usado tanto en el
 * editor de planes (/plataforma/plans) como en la vista de features por
 * empresa (/plataforma/companies), y leído por hasFeature() (ver
 * feature-gating.ts) para gatear funcionalidad real en el lado del tenant.
 *
 * Cada feature tiene una `key` estable (no cambia aunque se traduzca o
 * reformule el texto) — es lo que se guarda en Plan.features y
 * Subscription.customFeatures, y lo que hasFeature() compara. `label` es
 * solo para mostrar en la UI del admin, nunca se compara en código.
 *
 * `status`:
 *  - "live": hay un módulo real detrás. hasFeature() lo puede gatear hoy.
 *  - "partial": existe algo de código pero no una UI/flujo completo para
 *    el tenant todavía. hasFeature() funciona, pero no hay nada que gatear
 *    en el lado del tenant hasta que se construya esa pantalla/endpoint.
 *  - "planned": no existe ningún código funcional todavía. Se muestra en
 *    el checklist como referencia comercial, pero no se gatea nada.
 */
export type FeatureStatus = "live" | "partial" | "planned";

export interface FeatureDef {
  key: string;
  label: string;
  status: FeatureStatus;
}

export const FEATURE_CATALOG: FeatureDef[] = [
  { key: "menus_por_turno", label: "Menús por turno/hora", status: "planned" },
  { key: "gestion_mesas", label: "Gestión de mesas", status: "live" },
  { key: "comandas_cocina", label: "Comandas digitales para cocina", status: "live" },
  { key: "automatizaciones_avanzadas", label: "Automatizaciones avanzadas", status: "planned" },
  { key: "integracion_delivery", label: "Integración con delivery (Uber Eats, DoorDash, Rappi)", status: "planned" },
  { key: "whatsapp_business", label: "WhatsApp Business", status: "partial" },
  { key: "pagos_integrados", label: "Pagos integrados (tarjetas desde el POS)", status: "partial" },
  { key: "api_basica", label: "API básica", status: "planned" },
  { key: "conexion_contpaq_sat", label: "Conexión con Contpaq/SAT", status: "planned" },
  { key: "dashboard_avanzado", label: "Dashboard avanzado (15+ gráficos)", status: "partial" },
  { key: "control_acceso_rol", label: "Control de acceso por rol", status: "live" },
  { key: "auditoria_cajas", label: "Auditoría de cajas", status: "partial" },
  { key: "soporte_prioritario", label: "Soporte prioritario (4h)", status: "planned" },
  { key: "inventario_compartido", label: "Inventario compartido entre sucursales", status: "planned" },
  { key: "transferencias_automaticas", label: "Transferencias automáticas entre sucursales", status: "planned" },
  { key: "costeo_receta", label: "Costeo por receta", status: "planned" },
  { key: "dashboard_empresarial", label: "Dashboard empresarial (30+ métricas)", status: "planned" },
  { key: "reportes_consolidados", label: "Reportes consolidados", status: "planned" },
  { key: "proyecciones_ia", label: "Proyecciones con IA básica", status: "planned" },
  { key: "auditoria_avanzada", label: "Auditoría avanzada", status: "partial" },
  { key: "multi_moneda", label: "Multi-moneda", status: "planned" },
  { key: "soporte_247", label: "Soporte 24/7 con gestor de cuenta dedicado", status: "planned" },
];

export const FEATURE_KEYS = FEATURE_CATALOG.reduce(
  (acc, f) => ({ ...acc, [f.key.toUpperCase()]: f.key }),
  {} as Record<string, string>
);

/** Set de keys válidas, usado para filtrar cualquier valor legacy/basura guardado. */
export const VALID_FEATURE_KEYS = new Set(FEATURE_CATALOG.map((f) => f.key));

export function featureLabel(key: string): string {
  return FEATURE_CATALOG.find((f) => f.key === key)?.label ?? key;
}
