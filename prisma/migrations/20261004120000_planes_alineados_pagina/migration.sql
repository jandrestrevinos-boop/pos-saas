-- Alinea los planes con la página pública (tappysoftware.com).
-- SOLO AGREGA características que faltan: nunca quita ni reordena las que ya
-- tenga cada plan, así que no rompe lo que ya está configurado ni a las
-- empresas actuales. (Para quitar algo de un plan, se hace desde Super Admin → Planes.)
--
-- Profesional y Empresarial reciben ACTIVAS las funciones de WhatsApp Business y
-- Pagos integrados (Mercado Pago). Empresarial recibe además lo propio de multi-sucursal.

UPDATE "plans" SET "features" = COALESCE("features", '[]'::jsonb) || (
  SELECT COALESCE(jsonb_agg(k), '[]'::jsonb)
  FROM jsonb_array_elements_text('[
    "automatizaciones_basicas","comandas_cocina","control_acceso_rol","dashboard","reportes_avanzados",
    "historial_movimientos","alertas","exportacion_informacion","inventario_avanzado"
  ]'::jsonb) AS k
  WHERE NOT (COALESCE("features", '[]'::jsonb) @> to_jsonb(k))
)
WHERE "name" = 'Básico';

UPDATE "plans" SET "features" = COALESCE("features", '[]'::jsonb) || (
  SELECT COALESCE(jsonb_agg(k), '[]'::jsonb)
  FROM jsonb_array_elements_text('[
    "automatizaciones_basicas","automatizaciones_avanzadas","whatsapp_business","pagos_integrados",
    "comandas_cocina","control_acceso_rol","dashboard","reportes_avanzados",
    "historial_movimientos","alertas","exportacion_informacion","inventario_avanzado"
  ]'::jsonb) AS k
  WHERE NOT (COALESCE("features", '[]'::jsonb) @> to_jsonb(k))
)
WHERE "name" = 'Profesional';

UPDATE "plans" SET "features" = COALESCE("features", '[]'::jsonb) || (
  SELECT COALESCE(jsonb_agg(k), '[]'::jsonb)
  FROM jsonb_array_elements_text('[
    "automatizaciones_basicas","automatizaciones_avanzadas","whatsapp_business","pagos_integrados",
    "comandas_cocina","control_acceso_rol","dashboard","reportes_avanzados",
    "historial_movimientos","alertas","exportacion_informacion","inventario_avanzado",
    "dashboard_empresarial","multi_sucursal","auditoria_avanzada"
  ]'::jsonb) AS k
  WHERE NOT (COALESCE("features", '[]'::jsonb) @> to_jsonb(k))
)
WHERE "name" = 'Empresarial';
