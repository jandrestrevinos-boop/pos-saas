import { Fragment, type ReactNode } from "react";
import { clsx } from "clsx";
import { Card } from "@/components/ui";

/**
 * Tabla que se adapta al aparato:
 *  - Pantalla ancha (1280px o más): tabla normal.
 *  - Celular y tablet: una tarjeta por fila (sin scroll horizontal).
 *
 * Se define UNA sola vez cómo se ve cada columna (`render`) y sirve para los dos modos.
 */
export type ResponsiveColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  /**
   * Dónde va esta columna en la tarjeta del celular:
   *  "title" = arriba a la izquierda, "aside" = arriba a la derecha,
   *  "field" = en la cuadrícula de abajo con su etiqueta (por defecto), "hide" = no se muestra.
   */
  mobile?: "title" | "aside" | "field" | "hide";
  /** Clases extra solo para la celda de la tabla (computadora). */
  cellClassName?: string;
  /** Clases extra solo para el valor dentro de la tarjeta (celular). */
  mobileClassName?: string;
};

export function ResponsiveTable<T>({
  columns,
  rows,
  getRowId,
  expandedId = null,
  onRowClick,
  renderExpanded,
  renderActions,
}: {
  columns: ResponsiveColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Fila abierta (si se usa `renderExpanded`). */
  expandedId?: string | null;
  onRowClick?: (row: T) => void;
  /** Contenido que aparece debajo de la fila al abrirla. */
  renderExpanded?: (row: T) => ReactNode;
  /** Botones de la fila: última columna en la tabla, barra inferior en la tarjeta. Si devuelve null no se muestra nada. */
  renderActions?: (row: T) => ReactNode;
}) {
  const titleCols = columns.filter((c) => c.mobile === "title");
  const asideCols = columns.filter((c) => c.mobile === "aside");
  const fieldCols = columns.filter((c) => !c.mobile || c.mobile === "field");
  const totalCols = columns.length + (renderActions ? 1 : 0);

  return (
    <>
      {/* Computadora: tabla */}
      <Card className="ticket-edge overflow-hidden hidden xl:block">
        <table className="w-full text-sm">
          <thead className="bg-paper text-xs uppercase text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={clsx("px-4 py-3", c.align === "right" ? "text-right" : "text-left")}>
                  {c.header}
                </th>
              ))}
              {renderActions && <th className="px-4 py-3" aria-label="Acciones" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = getRowId(row);
              return (
                <Fragment key={id}>
                  <tr
                    className={clsx("border-t border-line hover:bg-paper", onRowClick && "cursor-pointer")}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={clsx("px-4 py-3", c.align === "right" && "text-right", c.cellClassName)}>
                        {c.render(row)}
                      </td>
                    ))}
                    {renderActions && <td className="px-4 py-3 text-right">{renderActions(row)}</td>}
                  </tr>
                  {renderExpanded && expandedId === id && (
                    <tr className="border-t border-line bg-paper">
                      <td colSpan={totalCols} className="px-4 py-3">
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Celular y tablet: tarjetas */}
      <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
        {rows.map((row) => {
          const id = getRowId(row);
          const actions = renderActions?.(row);
          return (
            <Card key={id} className="overflow-hidden min-w-0">
              <div
                className={clsx("p-4", onRowClick && "cursor-pointer active:bg-paper")}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {(titleCols.length > 0 || asideCols.length > 0) && (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      {titleCols.map((c) => (
                        <div key={c.key} className={clsx("break-words", c.mobileClassName)}>
                          {c.render(row)}
                        </div>
                      ))}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1 text-right">
                      {asideCols.map((c) => (
                        <div key={c.key} className={c.mobileClassName}>
                          {c.render(row)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {fieldCols.length > 0 && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {fieldCols.map((c) => (
                      <div key={c.key} className="min-w-0">
                        <dt className="text-[11px] uppercase tracking-wide text-muted">{c.header}</dt>
                        <dd className={clsx("break-words", c.mobileClassName)}>{c.render(row)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {renderExpanded && expandedId === id && (
                  <div className="mt-3 pt-3 border-t border-line" onClick={(e) => e.stopPropagation()}>
                    {renderExpanded(row)}
                  </div>
                )}
              </div>
              {actions && <div className="border-t border-line px-3 py-2 flex flex-wrap justify-end gap-1">{actions}</div>}
            </Card>
          );
        })}
      </div>
    </>
  );
}
