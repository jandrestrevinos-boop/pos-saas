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
  /**
   * true = el código SÍ bloquea esta función a las empresas cuyo plan no la
   * incluye (hasFeature()). false = la función existe (o no) pero marcarla o
   * desmarcarla en un plan todavía no cambia lo que la empresa puede hacer;
   * hoy es solo la promesa comercial. El editor de planes lo muestra.
   */
  enforced: boolean;
}

export const FEATURE_CATALOG: FeatureDef[] = [
  // ── Construidas y bloqueadas por plan ───────────────────────────────
  { key: "gestion_mesas", label: "Gestión de mesas", status: "live", enforced: true },
  { key: "pagos_integrados", label: "Pagos integrados (tarjetas desde el POS)", status: "live", enforced: true },
  { key: "whatsapp_business", label: "WhatsApp Business", status: "live", enforced: true },
  { key: "dashboard_empresarial", label: "Dashboard empresarial", status: "live", enforced: true },
  // Programa de clientes frecuentes: opción independiente. No viene incluida en ningún plan
  // por defecto; se activa por plan o por empresa (plan personalizado) desde Super Admin.
  { key: "clientes_frecuentes", label: "Programa de clientes frecuentes (tarjeta digital con QR)", status: "live", enforced: true },
  // Modo "solo clientes frecuentes": para restaurantes que contratan el programa SIN el POS.
  // Marcar esta casilla (junto con clientes_frecuentes) oculta y bloquea Punto de Venta, Caja, etc.
  { key: "solo_clientes_frecuentes", label: "Modo solo clientes frecuentes (sin Punto de Venta)", status: "live", enforced: true },

  // ── Construidas pero disponibles en todos los planes (marcarlas no cambia nada todavía) ──
  { key: "comandas_cocina", label: "Comandas digitales para cocina", status: "live", enforced: false },
  { key: "control_acceso_rol", label: "Control de acceso por rol (Permisos por usuario)", status: "live", enforced: false },
  { key: "auditoria_avanzada", label: "Auditoría avanzada", status: "live", enforced: false },
  { key: "dashboard", label: "Dashboard", status: "live", enforced: false },
  { key: "reportes_avanzados", label: "Reportes avanzados", status: "live", enforced: false },
  { key: "historial_movimientos", label: "Historial de movimientos", status: "live", enforced: false },

  // ── Construidas a medias ────────────────────────────────────────────
  { key: "inventario_avanzado", label: "Inventario avanzado (mínimos, alertas, movimientos)", status: "live", enforced: false },
  { key: "promociones_descuentos", label: "Promociones y descuentos", status: "partial", enforced: false },
  { key: "multi_sucursal", label: "Multi-sucursal (crear y operar varias sucursales)", status: "live", enforced: false },
  { key: "dashboard_avanzado", label: "Dashboard avanzado (15+ gráficos)", status: "live", enforced: false },
  { key: "auditoria_cajas", label: "Auditoría de cajas", status: "live", enforced: false },

  // ── Sin construir (hoy solo son promesa comercial) ──────────────────
  { key: "compras_proveedores", label: "Compras y proveedores", status: "planned", enforced: false },
  { key: "alertas", label: "Alertas", status: "live", enforced: false },
  { key: "exportacion_informacion", label: "Exportación de información", status: "live", enforced: false },
  { key: "automatizaciones_basicas", label: "Automatizaciones básicas (comandas a pantalla de cocina, sin impresora)", status: "live", enforced: false },
  { key: "automatizaciones_avanzadas", label: "Automatizaciones avanzadas (WhatsApp + Mercado Pago)", status: "live", enforced: false },
  { key: "api_basica", label: "API básica", status: "planned", enforced: false },
  { key: "api_avanzada", label: "API avanzada", status: "planned", enforced: false },
  { key: "permisos_avanzados", label: "Permisos avanzados", status: "planned", enforced: false },
  { key: "inventario_compartido", label: "Inventario por sucursal y transferencias entre sucursales", status: "live", enforced: false },
  { key: "reportes_consolidados", label: "Reportes consolidados", status: "planned", enforced: false },
  { key: "transferencias_automaticas", label: "Transferencias automáticas entre sucursales", status: "planned", enforced: false },
  { key: "menus_por_turno", label: "Menús por turno/hora", status: "planned", enforced: false },
  { key: "integracion_delivery", label: "Integración con delivery (Uber Eats, DoorDash, Rappi)", status: "planned", enforced: false },
  { key: "conexion_contpaq_sat", label: "Conexión con Contpaq/SAT", status: "planned", enforced: false },
  { key: "costeo_receta", label: "Costeo por receta", status: "planned", enforced: false },
  { key: "proyecciones_ia", label: "Proyecciones con IA básica", status: "planned", enforced: false },
  { key: "multi_moneda", label: "Multi-moneda", status: "planned", enforced: false },

  // ── Servicio humano (no es código, nunca debería bloquear nada) ─────
  { key: "soporte_prioritario", label: "Soporte prioritario (4h)", status: "planned", enforced: false },
  { key: "soporte_247", label: "Soporte 24/7 con gestor de cuenta dedicado", status: "planned", enforced: false },
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
