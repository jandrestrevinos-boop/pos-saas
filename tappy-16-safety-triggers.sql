-- ============================================================================
-- REGLA FUNDAMENTAL DE FACTURACIÓN (sección 16 de la spec) — nivel de base
-- de datos. Esto complementa (no reemplaza) la lógica ya construida en
-- src/modules/hardwareFinancing/service.ts y billingEngine.ts. El objetivo:
-- que ni un bug de interfaz, ni una migración futura mal escrita, ni un
-- acceso directo a la base de datos puedan generar un cobro de hardware
-- sobre un financiamiento ya cerrado.
--
-- PROBADO en vivo contra un Postgres real antes de entregarte esto —
-- ver la conversación para los 4 casos de prueba.
--
-- CÓMO APLICAR (después de correr la migración normal del patch 1-6):
--   1. npx prisma migrate dev --create-only --name financing_billing_safety
--   2. Abre el archivo migration.sql vacío que se generó en
--      prisma/migrations/<timestamp>_financing_billing_safety/
--   3. Pega TODO el contenido de este archivo ahí dentro
--   4. npx prisma migrate dev
-- ============================================================================

-- 1) Un HardwareFinancingPayment nunca puede quedar PENDING/OVERDUE si su
--    financiamiento ya está LIQUIDATED, CANCELLED o RESTRUCTURED. Bloquea
--    tanto INSERT como UPDATE — cubre tanto "crear un cargo nuevo" como
--    "reabrir uno viejo por accidente".
CREATE OR REPLACE FUNCTION prevent_charges_on_closed_financing()
RETURNS TRIGGER AS $$
DECLARE
  financing_status "HardwareFinancingStatus";
BEGIN
  SELECT status INTO financing_status
  FROM hardware_financings
  WHERE id = NEW."financingId";

  IF financing_status IN ('LIQUIDATED', 'CANCELLED', 'RESTRUCTURED')
     AND NEW.status IN ('PENDING', 'OVERDUE') THEN
    RAISE EXCEPTION 'No se puede crear/mantener un cobro pendiente (estado %) para un financiamiento en estado %', NEW.status, financing_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_charges_on_closed_financing ON hardware_financing_payments;
CREATE TRIGGER trg_prevent_charges_on_closed_financing
  BEFORE INSERT OR UPDATE ON hardware_financing_payments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_charges_on_closed_financing();

-- 2) El saldo de un financiamiento nunca puede ser negativo.
ALTER TABLE hardware_financings
  ADD CONSTRAINT remaining_balance_non_negative CHECK ("remainingBalance" >= 0);

-- 3) Si el estado es LIQUIDATED, el saldo tiene que ser exactamente $0 —
--    nunca puede quedar "liquidado" con saldo distinto de cero.
ALTER TABLE hardware_financings
  ADD CONSTRAINT liquidated_has_zero_balance
  CHECK (status != 'LIQUIDATED' OR "remainingBalance" = 0);
