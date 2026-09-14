export type Periodicity = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export interface HardwareLineItemInput {
  productId?: string;
  productName: string;
  catalogUnitPrice: number;
  negotiatedUnitPrice: number;
  quantity: number;
}

export interface InstallmentScheduleEntry {
  paymentNumber: number;
  dueDate: Date;
  amount: number;
}

export interface InstallmentSchedule {
  installmentAmount: number;
  entries: InstallmentScheduleEntry[];
  totalScheduled: number;
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** Suma meses respetando fin de mes (evita el bug clásico de "31 de enero + 1 mes"). */
function addMonthsSafe(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const targetMonth = result.getMonth() + months;
  result.setDate(1); // evita overflow al cambiar de mes
  result.setMonth(targetMonth);
  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDayOfTargetMonth));
  return result;
}

function addDaysSafe(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function nextDueDate(from: Date, periodicity: Periodicity): Date {
  switch (periodicity) {
    case "WEEKLY":
      return addDaysSafe(from, 7);
    case "BIWEEKLY":
      return addDaysSafe(from, 15);
    case "MONTHLY":
    default:
      return addMonthsSafe(from, 1);
  }
}

export function computeLineItemTotals(items: HardwareLineItemInput[]) {
  let listValueCents = 0;
  let negotiatedValueCents = 0;

  const lines = items.map((item) => {
    const unitListCents = toCents(item.catalogUnitPrice);
    const unitNegotiatedCents = toCents(item.negotiatedUnitPrice);
    const subtotalCents = unitNegotiatedCents * item.quantity;

    listValueCents += unitListCents * item.quantity;
    negotiatedValueCents += subtotalCents;

    return { ...item, subtotal: fromCents(subtotalCents) };
  });

  return {
    lines,
    hardwareListValue: fromCents(listValueCents),
    negotiatedValue: fromCents(negotiatedValueCents),
  };
}

/**
 * Saldo financiado = valor negociado - descuento - enganche + cargo
 * financiero fijo + interés (calculado UNA vez sobre el saldo base, no
 * compuesto mensual). El calendario nunca recalcula esto después.
 */
export function computeFinancedBalance(params: {
  negotiatedValue: number;
  discount: number;
  downPayment: number;
  financialCharge: number;
  interestRate: number;
}): number {
  const baseCents =
    toCents(params.negotiatedValue) - toCents(params.discount) - toCents(params.downPayment);

  if (baseCents < 0) {
    throw new Error("El enganche + descuento no puede ser mayor al valor negociado del hardware.");
  }

  const interestCents = Math.round(baseCents * params.interestRate);
  const financialChargeCents = toCents(params.financialCharge);

  return fromCents(baseCents + interestCents + financialChargeCents);
}

/**
 * Genera el calendario de pagos garantizando que la suma sea EXACTAMENTE
 * igual al saldo financiado. El último pago absorbe el residuo de
 * redondeo (regla #6 de la spec: nunca debe haber diferencia de centavos).
 */
export function buildInstallmentSchedule(params: {
  financedBalance: number;
  totalInstallments: number;
  periodicity: Periodicity;
  firstPaymentDueDate: Date;
}): InstallmentSchedule {
  const { financedBalance, totalInstallments, periodicity, firstPaymentDueDate } = params;

  if (totalInstallments < 1) {
    throw new Error("totalInstallments debe ser al menos 1.");
  }

  const totalCents = toCents(financedBalance);
  const baseInstallmentCents = Math.floor(totalCents / totalInstallments);
  const remainderCents = totalCents - baseInstallmentCents * totalInstallments;

  const entries: InstallmentScheduleEntry[] = [];
  let dueDate = firstPaymentDueDate;

  for (let i = 1; i <= totalInstallments; i++) {
    const isLast = i === totalInstallments;
    const amountCents = isLast ? baseInstallmentCents + remainderCents : baseInstallmentCents;

    entries.push({ paymentNumber: i, dueDate, amount: fromCents(amountCents) });
    dueDate = nextDueDate(dueDate, periodicity);
  }

  const totalScheduled = fromCents(entries.reduce((sum, e) => sum + toCents(e.amount), 0));

  return { installmentAmount: fromCents(baseInstallmentCents), entries, totalScheduled };
}

export function buildRestructuredSchedule(params: {
  remainingBalance: number;
  newTotalInstallments: number;
  periodicity: Periodicity;
  firstPaymentDueDate: Date;
}): InstallmentSchedule {
  return buildInstallmentSchedule({
    financedBalance: params.remainingBalance,
    totalInstallments: params.newTotalInstallments,
    periodicity: params.periodicity,
    firstPaymentDueDate: params.firstPaymentDueDate,
  });
}

/**
 * Recalcula el calendario restante después de un ABONO EXTRAORDINARIO
 * (sección 12 de la spec): mantiene el MISMO monto de mensualidad que ya
 * tenía el financiamiento (no lo cambia), y en vez de eso reduce el
 * NÚMERO de pagos restantes necesarios para cubrir el nuevo saldo. El
 * último pago absorbe el redondeo, igual que en el calendario original.
 * Nunca toca pagos ya registrados — solo genera el calendario de lo que
 * falta a partir de aquí.
 */
export function buildAbonoAdjustedSchedule(params: {
  newRemainingBalance: number;
  targetInstallmentAmount: number;
  periodicity: Periodicity;
  nextPaymentDueDate: Date;
}): InstallmentSchedule {
  const balanceCents = toCents(params.newRemainingBalance);
  const targetCents = toCents(params.targetInstallmentAmount);

  if (balanceCents <= 0) {
    return { installmentAmount: 0, entries: [], totalScheduled: 0 };
  }

  const impliedInstallments = Math.max(1, Math.ceil(balanceCents / targetCents));

  return buildInstallmentSchedule({
    financedBalance: params.newRemainingBalance,
    totalInstallments: impliedInstallments,
    periodicity: params.periodicity,
    firstPaymentDueDate: params.nextPaymentDueDate,
  });
}
