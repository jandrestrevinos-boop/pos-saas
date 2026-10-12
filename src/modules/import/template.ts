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

/** Plantilla .xlsx de importación de historial de ventas. */
export async function buildSalesTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const info = wb.addWorksheet("Instrucciones");
  info.getColumn(1).width = 100;
  const lines: [string, boolean][] = [
    ["Plantilla de importación de historial de ventas — Tappy", true],
    ["", false],
    ["1. Llena la hoja 'Ventas': una fila por producto vendido. Borra la fila de ejemplo.", false],
    ["2. Las filas con el mismo Folio forman un solo ticket (el total es la suma de sus filas).", false],
    ["", false],
    ["Reglas", true],
    ["• Encabezado azul = obligatorio. Encabezado gris = opcional. No cambies los encabezados.", false],
    ["• Fecha: AAAA-MM-DD HH:MM (ejemplo 2026-09-15 14:30) o DD/MM/AAAA HH:MM. Hora de Monterrey. No puede ser futura.", false],
    ["• Cantidad: número entero. Precio unitario: en pesos, sin símbolo $.", false],
    ["• El producto se busca por nombre exacto. Si no existe en Tappy, se crea INACTIVO (no aparece en el POS).", false],
    ["• Método de pago: Efectivo, Tarjeta, Transferencia, Mercado Pago u Otro (vacío = Otro).", false],
    ["• Sucursal: si el nombre coincide con una de tus sucursales se usa esa; si no, tu sucursal activa.", false],
    ["• Un ticket con error en cualquiera de sus filas se omite completo.", false],
    ["• Puedes volver a subir el mismo archivo: los folios ya importados se omiten, no se duplican.", false],
    ["• Las ventas importadas alimentan reportes e historial, pero NO mueven inventario, caja ni cocina.", false],
  ];
  lines.forEach(([text, bold], i) => {
    const c = info.getCell(i + 1, 1);
    c.value = text;
    c.font = { name: "Arial", size: i === 0 ? 14 : 11, bold };
  });

  const ws = wb.addWorksheet("Ventas");
  const cols: [string, boolean, number][] = [
    ["Fecha", true, 18],
    ["Folio", true, 14],
    ["Producto", true, 30],
    ["Cantidad", true, 11],
    ["Precio unitario", true, 16],
    ["Método de pago", false, 18],
    ["Cajero", false, 18],
    ["Sucursal", false, 18],
  ];
  cols.forEach(([title, required, width], i) => {
    ws.getColumn(i + 1).width = width;
    const c = ws.getCell(1, i + 1);
    c.value = title;
    c.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: required ? "FF0038FF" : "FF64748B" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.getRow(1).height = 24;
  ws.views = [{ state: "frozen", ySplit: 1 }];

  ["2026-09-15 14:30", "A-1001", "Tacos al pastor (orden)", 2, 85, "Efectivo", "María", "Matriz"].forEach((v, i) => {
    const c = ws.getCell(2, i + 1);
    c.value = v;
    c.font = { name: "Arial", italic: true, color: { argb: "FF7A5C00" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9DB" } };
  });
  ws.getCell("J1").value = "Fila amarilla = ejemplo (bórrala)";
  ws.getCell("J1").font = { name: "Arial", italic: true, color: { argb: "FF7A5C00" } };

  for (let r = 2; r <= 2001; r++) {
    ws.getCell(r, 1).numFmt = "@"; // que Excel no convierta la fecha
    ws.getCell(r, 2).numFmt = "@";
    ws.getCell(r, 6).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Efectivo,Tarjeta,Transferencia,Mercado Pago,Otro"'],
    };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
