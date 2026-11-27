import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  parseRequirementText,
  readRequirementFile,
} from "../lib/requirement-import.ts";

test("CSV with explicit null unit/brand/qty leaves them blank without assuming defaults", async () => {
  const csv = [
    "Product,Quantity,Unit,Brand",
    "Basmati Rice,5,kg,India Gate",
    "Toor Dal,2,null,null",
    "Cooking Oil,null,litre,Fortune",
    "Salt,1,N/A,-",
  ].join("\n");

  const file = new File([csv], "monthly.csv", { type: "text/csv" });
  const items = await readRequirementFile(file);

  assert.deepEqual(items, [
    { name: "Basmati Rice", quantity: 5, unit: "kg", brand: "India Gate" },
    { name: "Toor Dal", quantity: 2, unit: "", brand: "" },
    { name: "Cooking Oil", quantity: 0, unit: "litre", brand: "Fortune" },
    { name: "Salt", quantity: 1, unit: "", brand: "" },
  ]);
});

test("Headerless CSV/TXT does not assume 1 pack or Any when missing or null", () => {
  const text = [
    "Rice, 5 kg, India Gate",
    "Sugar, 2, null",
    "Milk, 3 l",
    "Turmeric",
  ].join("\n");

  const items = parseRequirementText(text);
  assert.deepEqual(items, [
    { name: "Rice", quantity: 5, unit: "kg", brand: "India Gate" },
    { name: "Sugar", quantity: 2, unit: "", brand: "" },
    { name: "Milk", quantity: 3, unit: "litre", brand: "" },
    { name: "Turmeric", quantity: 0, unit: "", brand: "" },
  ]);
});

test("XLSX workbook extracts rows accurately and preserves null/empty units as blank", async () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Item Name", "Qty", "Unit", "Preferred Brand"],
    ["Idli Rice", 10, "kg", "Aachi"],
    ["Urad Dal", 3, "null", null],
    ["Ghee", 500, "ml", "Aavin"],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "List");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const file = new File([buf], "groceries.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const items = await readRequirementFile(file);

  assert.deepEqual(items, [
    { name: "Idli Rice", quantity: 10, unit: "kg", brand: "Aachi" },
    { name: "Urad Dal", quantity: 3, unit: "", brand: "" },
    { name: "Ghee", quantity: 500, unit: "ml", brand: "Aavin" },
  ]);
});

test("PDF file extracts requirement rows accurately and leaves null unit/brand blank", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 400]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const lines = [
    "Product, Quantity, Unit, Brand",
    "Wheat Flour, 5, kg, Aashirvaad",
    "Jaggery, 2, null, null",
  ];
  lines.forEach((line, idx) => {
    page.drawText(line, { x: 40, y: 340 - idx * 24, size: 12, font });
  });

  const pdfBytes = await doc.save();
  const file = new File([pdfBytes], "monthly-list.pdf", { type: "application/pdf" });
  const items = await readRequirementFile(file);

  assert.deepEqual(items, [
    { name: "Wheat Flour", quantity: 5, unit: "kg", brand: "Aashirvaad" },
    { name: "Jaggery", quantity: 2, unit: "", brand: "" },
  ]);
});

test("PDF table with title row and separate column cells groups each row accurately", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 500]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText("Product List", { x: 240, y: 450, size: 16, font });

  const tableRows = [
    ["Product Name", "Quantity", "Unit", "Brand Preference"],
    ["Rice", "5", "kg", "Any"],
    ["Milk", "1", "L", "Aavin"],
    ["Eggs", "12", "pcs", "Any"],
    ["Tea Powder", "250", "g", "Tata Tea"],
  ];
  const xs = [60, 220, 310, 390];
  tableRows.forEach((cols, rowIdx) => {
    const y = 400 - rowIdx * 28;
    cols.forEach((cell, colIdx) => {
      page.drawText(cell, { x: xs[colIdx], y, size: 11, font });
    });
  });

  const pdfBytes = await doc.save();
  const file = new File([pdfBytes], "product-list.pdf", { type: "application/pdf" });
  const items = await readRequirementFile(file);

  assert.deepEqual(items, [
    { name: "Rice", quantity: 5, unit: "kg", brand: "Any" },
    { name: "Milk", quantity: 1, unit: "litre", brand: "Aavin" },
    { name: "Eggs", quantity: 12, unit: "piece", brand: "Any" },
    { name: "Tea Powder", quantity: 250, unit: "g", brand: "Tata Tea" },
  ]);
});
