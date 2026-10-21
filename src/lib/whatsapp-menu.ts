/**
 * Lógica pura (sin base de datos) del pedido de menús completos por WhatsApp: el bot pregunta grupo
 * por grupo (guarnición, bebida...) y entiende la respuesta del cliente por número ("2") o por
 * nombre ("el puré"). Separada del procesador de mensajes para poder probarla sola.
 */
export interface WaMenuOption {
  id: string;
  name: string;
  extraPrice: number;
}
export interface WaMenuGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  /** Grupo de extras opcionales: lo que se elija es "extra" aunque cueste $0. */
  isExtra?: boolean;
  options: WaMenuOption[];
}

export function formatWaPrice(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function optionLabel(o: WaMenuOption, groupIsExtra = false): string {
  if (o.extraPrice > 0) return `${o.name} (+${formatWaPrice(o.extraPrice)} extra)`;
  return groupIsExtra ? `${o.name} (extra sin costo)` : o.name;
}

/** "Guarnición (elige 1): Arroz, Puré de papa (+$45 extra)" — para mostrar el menú completo. */
export function describeGroup(g: WaMenuGroup): string {
  const rule = g.minSelect === g.maxSelect ? `elige ${g.maxSelect}` : g.minSelect === 0 ? `hasta ${g.maxSelect}` : `elige de ${g.minSelect} a ${g.maxSelect}`;
  return `${g.name} (${rule}): ${g.options.map((o) => optionLabel(o, g.isExtra)).join(", ")}`;
}

/** Pregunta del bot para un grupo, con las opciones numeradas. */
export function groupPrompt(g: WaMenuGroup, position: number, total: number): string {
  const rule =
    g.minSelect === g.maxSelect
      ? `Elige *${g.maxSelect}*`
      : g.minSelect === 0
        ? g.isExtra
          ? `¿Quieres agregar algún extra? Elige hasta *${g.maxSelect}*, o escribe *ninguna* si no`
          : `Elige hasta *${g.maxSelect}* (o escribe *ninguna*)`
        : `Elige de *${g.minSelect}* a *${g.maxSelect}*`;
  const lines = g.options.map((o, i) => `${i + 1}. ${optionLabel(o, g.isExtra)}`);
  return [
    `🍽️ *${g.name}* (${position} de ${total})`,
    rule,
    ...lines,
    "",
    g.maxSelect > 1 ? "Responde con los números o nombres, por ejemplo: _1 y 3_" : "Responde con el número o el nombre, por ejemplo: _2_",
    "Para cancelar este menú escribe *cancelar*.",
  ].join("\n");
}

export type ParseResult = { ok: true; optionIds: string[] } | { ok: false; error: string };

const STOP_WORDS = new Set(["con", "por", "favor", "del", "las", "los", "una", "uno", "unos", "unas", "quiero", "quisiera", "pon", "ponme", "dame", "para", "mas", "como", "esa", "ese", "eso"]);
const NONE_WORDS = ["ninguna", "ninguno", "nada", "sin", "no", "ningun"];

/** Interpreta la respuesta del cliente para UN grupo. */
export function parseGroupAnswer(text: string, g: WaMenuGroup): ParseResult {
  const norm = normalize(text);
  if (!norm) return { ok: false, error: "No entendí tu respuesta." };

  if (g.minSelect === 0 && NONE_WORDS.includes(norm)) return { ok: true, optionIds: [] };

  const picked: string[] = [];
  const add = (id: string) => {
    if (!picked.includes(id)) picked.push(id);
  };

  // 1) Números ("2", "1 y 3", "1,3"): solo si TODO el mensaje son números y conectores.
  const onlyNumbers = /^[0-9\s,y]+$/.test(norm.replace(/\be\b/g, "y")) && /[0-9]/.test(norm);
  if (onlyNumbers) {
    const nums = norm.match(/[0-9]+/g) ?? [];
    for (const n of nums) {
      const idx = Number(n) - 1;
      if (idx < 0 || idx >= g.options.length) return { ok: false, error: `El número ${n} no está en la lista.` };
      add(g.options[idx].id);
    }
  } else {
    // 2) Por nombre: nombre exacto de la opción dentro del mensaje; si no, por coincidencia parcial única.
    const normOptions = g.options.map((o) => ({ id: o.id, norm: normalize(o.name) }));
    const exact = normOptions.filter((o) => o.norm && (` ${norm} `).includes(` ${o.norm} `));
    // "arroz con frijoles" contiene también "arroz": si una opción coincide completa, la más corta
    // que va dentro de ella no cuenta como una segunda elección.
    for (const o of exact) {
      const insideAnother = exact.some((other) => other.id !== o.id && (` ${other.norm} `).includes(` ${o.norm} `));
      if (!insideAnother) add(o.id);
    }
    // Coincidencia parcial ("pure" -> "Puré de papa"): solo con palabras que no pertenecen a una opción
    // ya reconocida y que apuntan a UNA sola opción de la lista.
    const consumed = new Set<string>();
    for (const id of picked) {
      const o = normOptions.find((x) => x.id === id);
      o?.norm.split(" ").forEach((w) => consumed.add(w));
    }
    const words = norm.split(" ").filter((w) => w.length >= 3 && !consumed.has(w) && !STOP_WORDS.has(w));
    for (const w of words) {
      const hits = normOptions.filter((o) => o.norm.split(" ").includes(w));
      if (hits.length === 1) add(hits[0].id);
    }
    if (picked.length === 0) return { ok: false, error: "No encontré esa opción en la lista." };
  }

  if (picked.length < g.minSelect || picked.length > g.maxSelect) {
    return {
      ok: false,
      error:
        g.minSelect === g.maxSelect
          ? `En *${g.name}* debes elegir ${g.minSelect}.`
          : `En *${g.name}* elige entre ${g.minSelect} y ${g.maxSelect}.`,
    };
  }
  return { ok: true, optionIds: picked };
}

export function isCancelText(text: string): boolean {
  const n = normalize(text);
  return ["cancelar", "cancela", "cancelo", "ya no", "ya no quiero", "no quiero", "olvidalo", "quitalo", "quita eso"].includes(n);
}
