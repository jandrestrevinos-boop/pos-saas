import ExcelJS from "exceljs";

/** Plantilla .xlsx de importación de productos (se descarga desde la pantalla de importar). */
export async function buildProductsTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const info = wb.addWorksheet("Instrucciones");
  info.getColumn(1).width = 100;
  const lines: [string, boolean][] = [
    ["Plantilla de importación de productos — Tappy", true],
    ["", false],
    ["1. Llena la hoja 'Productos' (un producto por fila) y borra la fila de ejemplo.", false],
    ["2. En Tappy entra a Productos > Importar productos, sube el archivo y revisa la vista previa antes de confirmar.", false],
    ["", false],
    ["Reglas", true],
    ["• Encabezado azul = obligatorio. Encabezado gris = opcional. No cambies los nombres de los encabezados.", false],
    ["• Precio y costo: solo números, en pesos (sin símbolo $).", false],
    ["• Si la categoría no existe en Tappy, se crea sola.", false],
    ["• Si el producto ya existe (mismo SKU, o mismo nombre si no hay SKU), se actualiza en lugar de duplicarse.", false],
    ["• Las celdas vacías no borran datos que el producto ya tenga en Tappy.", false],
    ["• Existencia inicial: si la llenas, el producto controla inventario y la existencia se carga en tu sucursal activa.", false],
    ["• Activo: Sí o No (vacío = Sí).", false],
  ];
  lines.forEach(([text, bold], i) => {
    const c = info.getCell(i + 1, 1);
    c.value = text;
    c.font = { name: "Arial", size: i === 0 ? 14 : 11, bold };
  });

  const ws = wb.addWorksheet("Productos");
  const cols: [string, boolean, number][] = [
    ["Nombre", true, 32],
    ["Categoría", true, 20],
    ["Precio", true, 12],
    ["Costo", false, 12],
    ["SKU", false, 14],
    ["Código de barras", false, 18],
    ["Descripción", false, 36],
    ["Existencia inicial", false, 18],
    ["Activo", false, 10],
  ];
  cols.forEach(([title, required, width], i) => {
    const col = ws.getColumn(i + 1);
    col.width = width;
    const c = ws.getCell(1, i + 1);
    c.value = title;
    c.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: required ? "FF0038FF" : "FF64748B" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.getRow(1).height = 24;
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const example = ["Tacos al pastor (orden)", "Tacos", 85, 32, "TAC-001", "", "Orden de 5 tacos con piña", 50, "Sí"];
  example.forEach((v, i) => {
    const c = ws.getCell(2, i + 1);
    c.value = v;
    c.font = { name: "Arial", italic: true, color: { argb: "FF7A5C00" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9DB" } };
  });
  ws.getCell("K1").value = "Fila amarilla = ejemplo (bórrala)";
  ws.getCell("K1").font = { name: "Arial", italic: true, color: { argb: "FF7A5C00" } };

  for (let r = 2; r <= 501; r++) {
    ws.getCell(r, 5).numFmt = "@";
    ws.getCell(r, 6).numFmt = "@";
    ws.getCell(r, 9).dataValidation = { type: "list", allowBlank: true, formulae: ['"Sí,No"'] };
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
