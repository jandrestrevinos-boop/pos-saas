/** Botón "Exportar a Excel (CSV)": simple enlace de descarga a /api/export. */
export function ExportButton({
  dataset,
  from,
  to,
  label = "Exportar CSV",
}: {
  dataset: "sales" | "products" | "movements" | "customers";
  from?: string;
  to?: string;
  label?: string;
}) {
  const params = new URLSearchParams({ dataset });
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  return (
    <a
      href={`/api/export?${params.toString()}`}
      className="inline-flex items-center rounded-md border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-paper"
    >
      ⬇ {label}
    </a>
  );
}
