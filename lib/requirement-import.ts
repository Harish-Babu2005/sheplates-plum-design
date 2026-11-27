export type ParsedRequirementItem = {
  name: string;
  quantity: number;
  unit: string;
  brand: string;
};

const NULLISH_TOKENS = new Set([
  "",
  "null",
  "nil",
  "none",
  "n/a",
  "na",
  "-",
  "--",
  "undefined",
]);

const UNIT_ALIASES: Record<string, string> = {
  kg: "kg",
  kgs: "kg",
  kilogram: "kg",
  kilograms: "kg",
  g: "g",
  gm: "g",
  gms: "g",
  gram: "g",
  grams: "g",
  l: "litre",
  lt: "litre",
  ltr: "litre",
  ltrs: "litre",
  liter: "litre",
  liters: "litre",
  litre: "litre",
  litres: "litre",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  pc: "piece",
  pcs: "piece",
  piece: "piece",
  pieces: "piece",
  nos: "piece",
  no: "piece",
  unit: "piece",
  units: "piece",
  pack: "pack",
  packs: "pack",
  pkt: "pack",
  pkts: "pack",
  packet: "pack",
  packets: "pack",
  doz: "dozen",
  dozen: "dozen",
  dozens: "dozen",
};

/** Returns true when a cell or token explicitly represents empty / null / N/A. */
export function isNullishToken(raw: unknown): boolean {
  if (raw == null) return true;
  const normalized = String(raw).trim().toLowerCase();
  return NULLISH_TOKENS.has(normalized);
}

/** Normalizes known unit aliases without inventing a default when empty/null. */
export function normalizeRequirementUnit(raw: unknown): string {
  if (isNullishToken(raw)) return "";
  const cleaned = String(raw).trim().toLowerCase();
  return UNIT_ALIASES[cleaned] ?? cleaned;
}

/** Normalizes brand without inventing a default when empty/null. */
export function normalizeRequirementBrand(raw: unknown): string {
  if (isNullishToken(raw)) return "";
  return String(raw).trim();
}

/** Parses quantity strictly; returns 0 (blank in UI) when null, empty, or non-numeric. */
export function parseRequirementQuantity(raw: unknown): number {
  if (isNullishToken(raw)) return 0;
  const num = Number(String(raw).trim());
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function parseQtyAndUnit(raw: string): { quantity: number; unit: string } {
  if (isNullishToken(raw)) return { quantity: 0, unit: "" };
  const trimmed = raw.trim();
  const match = trimmed.match(/^([\d]+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (match) {
    return {
      quantity: parseRequirementQuantity(match[1]),
      unit: match[2] ? normalizeRequirementUnit(match[2]) : "",
    };
  }
  // If the cell is purely a unit word (or "null"), do not invent a quantity.
  if (/^[a-zA-Z]+$/.test(trimmed)) {
    return { quantity: 0, unit: normalizeRequirementUnit(trimmed) };
  }
  return { quantity: 0, unit: "" };
}

/** Splits a single CSV/TSV/TXT line while respecting double-quoted fields. */
export function splitDelimitedLine(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((cell) => cell.trim());
  }
  if (line.includes(",")) {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  }
  if (line.includes("|")) {
    return line.split("|").map((cell) => cell.trim());
  }
  if (line.includes(";")) {
    return line.split(";").map((cell) => cell.trim());
  }
  if (/\s+-\s+/.test(line)) {
    return line.split(/\s+-\s+/).map((cell) => cell.trim());
  }
  return [line.trim()];
}

type ColumnMap = {
  nameIdx: number;
  qtyIdx: number;
  unitIdx: number;
  brandIdx: number;
};

function detectHeaderColumns(row: string[]): ColumnMap | null {
  const lower = row.map((cell) => cell.trim().toLowerCase());
  const find = (patterns: RegExp[]) =>
    lower.findIndex((cell) => patterns.some((re) => re.test(cell)));

  const nameIdx = find([/^(product|item|name|grocery|groceries|material|description)(\s+(name|title|description))?$/, /product\s*name/, /item\s*name/]);
  const qtyIdx = find([/^(qty|quantity|count|amount)$/]);
  const unitIdx = find([/^(unit|uom|measure|pack\s*unit)$/]);
  const brandIdx = find([/^(brand|preferred\s*brand|brand\s*preference|make|company)$/]);

  if (nameIdx === -1) return null;
  if (qtyIdx === -1 && unitIdx === -1 && brandIdx === -1) return null;
  return { nameIdx, qtyIdx, unitIdx, brandIdx };
}

/** Converts tabular rows into requirement items without assuming missing or null values. */
export function parseRequirementRows(rawRows: string[][]): ParsedRequirementItem[] {
  const rows = rawRows
    .map((row) => row.map((cell) => (cell == null ? "" : String(cell).trim())))
    .filter((row) => row.some((cell) => !isNullishToken(cell)));

  if (!rows.length) return [];

  let headerMap: ColumnMap | null = null;
  let dataStartIdx = 0;
  for (let r = 0; r < Math.min(rows.length, 5); r += 1) {
    const detected = detectHeaderColumns(rows[r]);
    if (detected) {
      headerMap = detected;
      dataStartIdx = r + 1;
      break;
    }
  }
  const dataRows = rows.slice(dataStartIdx, dataStartIdx + 100);
  const items: ParsedRequirementItem[] = [];

  for (const row of dataRows) {
    if (headerMap) {
      const nameRaw = row[headerMap.nameIdx] ?? "";
      if (isNullishToken(nameRaw)) continue;

      const qtyRaw = headerMap.qtyIdx >= 0 ? (row[headerMap.qtyIdx] ?? "") : "";
      const unitRaw = headerMap.unitIdx >= 0 ? (row[headerMap.unitIdx] ?? "") : "";
      const brandRaw = headerMap.brandIdx >= 0 ? (row[headerMap.brandIdx] ?? "") : "";

      let quantity = 0;
      let unit = "";
      if (headerMap.qtyIdx >= 0 && headerMap.unitIdx === -1) {
        const parsed = parseQtyAndUnit(qtyRaw);
        quantity = parsed.quantity;
        unit = parsed.unit;
      } else {
        quantity = parseRequirementQuantity(qtyRaw);
        unit = normalizeRequirementUnit(unitRaw);
      }

      items.push({
        name: nameRaw.trim(),
        quantity,
        unit,
        brand: normalizeRequirementBrand(brandRaw),
      });
      continue;
    }

    const nameRaw = row[0] ?? "";
    if (isNullishToken(nameRaw)) continue;

    if (row.length >= 4) {
      items.push({
        name: nameRaw.trim(),
        quantity: parseRequirementQuantity(row[1]),
        unit: normalizeRequirementUnit(row[2]),
        brand: normalizeRequirementBrand(row[3]),
      });
      continue;
    }

    if (row.length === 3) {
      const col1 = row[1] ?? "";
      const col2 = row[2] ?? "";
      const pureNumberCol1 = /^\d+(?:\.\d+)?$/.test(col1.trim()) || isNullishToken(col1);
      const col2Lower = col2.trim().toLowerCase();
      const col2IsUnitOrNull = isNullishToken(col2) || col2Lower in UNIT_ALIASES;

      if (pureNumberCol1 && col2IsUnitOrNull) {
        items.push({
          name: nameRaw.trim(),
          quantity: parseRequirementQuantity(col1),
          unit: normalizeRequirementUnit(col2),
          brand: "",
        });
      } else {
        const parsed = parseQtyAndUnit(col1);
        items.push({
          name: nameRaw.trim(),
          quantity: parsed.quantity,
          unit: parsed.unit,
          brand: normalizeRequirementBrand(col2),
        });
      }
      continue;
    }

    if (row.length === 2) {
      const parsed = parseQtyAndUnit(row[1] ?? "");
      items.push({
        name: nameRaw.trim(),
        quantity: parsed.quantity,
        unit: parsed.unit,
        brand: "",
      });
      continue;
    }

    items.push({
      name: nameRaw.trim(),
      quantity: 0,
      unit: "",
      brand: "",
    });
  }

  return items;
}

export function parseRequirementText(text: string): ParsedRequirementItem[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitDelimitedLine);
  return parseRequirementRows(rows);
}

function decodePdfLiteralString(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next == null) break;
    i += 1;
    if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next === "b") out += "\b";
    else if (next === "f") out += "\f";
    else if (next === "(" || next === ")" || next === "\\") out += next;
    else if (/[0-7]/.test(next)) {
      const oct = raw.slice(i, i + 3).match(/^[0-7]{1,3}/)?.[0] || next;
      i += oct.length - 1;
      out += String.fromCharCode(parseInt(oct, 8));
    } else {
      out += next;
    }
  }
  return out;
}

function decodePdfHexString(hex: string): string {
  const cleaned = hex.replace(/\s+/g, "");
  if (!cleaned) return "";
  const padded = cleaned.length % 2 === 1 ? `${cleaned}0` : cleaned;
  const bytes: number[] = [];
  for (let i = 0; i < padded.length; i += 2) {
    bytes.push(parseInt(padded.slice(i, i + 2), 16));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return out;
  }
  return bytes.map((b) => String.fromCharCode(b)).join("");
}

function extractTextFromPdfContentStream(streamText: string): string {
  type TextChunk = { x: number; y: number; text: string };
  const chunks: TextChunk[] = [];
  let i = 0;
  let curX = 0;
  let curY = 0;
  let lineX = 0;
  let lineY = 0;
  let leading = 14;

  const readLiteral = (): string => {
    let depth = 1;
    let buf = "";
    i += 1;
    while (i < streamText.length && depth > 0) {
      const ch = streamText[i];
      if (ch === "\\") {
        buf += ch + (streamText[i + 1] ?? "");
        i += 2;
        continue;
      }
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          break;
        }
      }
      buf += ch;
      i += 1;
    }
    return decodePdfLiteralString(buf);
  };

  const readHex = (): string => {
    i += 1;
    let buf = "";
    while (i < streamText.length && streamText[i] !== ">") {
      buf += streamText[i];
      i += 1;
    }
    if (streamText[i] === ">") i += 1;
    return decodePdfHexString(buf);
  };

  let pendingStrings: string[] = [];
  let pendingNumbers: number[] = [];

  while (i < streamText.length) {
    const ch = streamText[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "%") {
      while (i < streamText.length && streamText[i] !== "\n" && streamText[i] !== "\r") i += 1;
      continue;
    }
    if (ch === "(") {
      pendingStrings.push(readLiteral());
      continue;
    }
    if (ch === "<" && streamText[i + 1] !== "<") {
      pendingStrings.push(readHex());
      continue;
    }
    if (ch === "[") {
      i += 1;
      let arrayText = "";
      while (i < streamText.length && streamText[i] !== "]") {
        if (streamText[i] === "(") arrayText += readLiteral();
        else if (streamText[i] === "<" && streamText[i + 1] !== "<") arrayText += readHex();
        else if (/[-\d.]/.test(streamText[i])) {
          let numStr = "";
          while (i < streamText.length && /[-\d.]/.test(streamText[i])) {
            numStr += streamText[i];
            i += 1;
          }
          const kerning = Number(numStr);
          if (Number.isFinite(kerning) && kerning < -180 && arrayText && !arrayText.endsWith(" ")) {
            arrayText += " ";
          }
        } else {
          i += 1;
        }
      }
      if (streamText[i] === "]") i += 1;
      pendingStrings.push(arrayText);
      continue;
    }

    if (/[-\d.]/.test(ch)) {
      let numStr = "";
      while (i < streamText.length && /[-\d.]/.test(streamText[i])) {
        numStr += streamText[i];
        i += 1;
      }
      const num = Number(numStr);
      if (Number.isFinite(num)) pendingNumbers.push(num);
      continue;
    }

    let op = "";
    while (i < streamText.length && !/[\s()<>[\]{}/%]/.test(streamText[i])) {
      op += streamText[i];
      i += 1;
    }
    if (!op) {
      i += 1;
      continue;
    }

    if (op === "Tj" || op === "TJ" || op === "'" || op === '"') {
      if (op === "'" || op === '"') {
        lineY -= leading;
        curX = lineX;
        curY = lineY;
      }
      const text = pendingStrings.join("").trim();
      if (text) {
        chunks.push({ x: curX, y: curY, text });
      }
      pendingStrings = [];
      pendingNumbers = [];
    } else if (op === "TL") {
      if (pendingNumbers.length) leading = pendingNumbers[pendingNumbers.length - 1];
      pendingNumbers = [];
    } else if (op === "T*") {
      lineY -= leading;
      curX = lineX;
      curY = lineY;
      pendingStrings = [];
      pendingNumbers = [];
    } else if (op === "Td" || op === "TD") {
      const dx = pendingNumbers.length >= 2 ? pendingNumbers[pendingNumbers.length - 2] : 0;
      const dy = pendingNumbers.length >= 2 ? pendingNumbers[pendingNumbers.length - 1] : 0;
      if (op === "TD") leading = -dy;
      lineX += dx;
      lineY += dy;
      curX = lineX;
      curY = lineY;
      pendingNumbers = [];
    } else if (op === "Tm") {
      if (pendingNumbers.length >= 6) {
        lineX = pendingNumbers[pendingNumbers.length - 2];
        lineY = pendingNumbers[pendingNumbers.length - 1];
        curX = lineX;
        curY = lineY;
      }
      pendingNumbers = [];
    } else if (op === "BT") {
      curX = 0;
      curY = 0;
      lineX = 0;
      lineY = 0;
      pendingStrings = [];
      pendingNumbers = [];
    } else {
      pendingStrings = [];
      pendingNumbers = [];
    }
  }

  if (!chunks.length) return "";

  // Group text chunks into rows by Y coordinate (2.5pt tolerance), top-to-bottom, left-to-right.
  const rows: { y: number; cells: TextChunk[] }[] = [];
  for (const chunk of chunks) {
    const existing = rows.find((row) => Math.abs(row.y - chunk.y) <= 2.5);
    if (existing) existing.cells.push(chunk);
    else rows.push({ y: chunk.y, cells: [chunk] });
  }
  rows.sort((a, b) => b.y - a.y);

  return rows
    .map((row) => {
      row.cells.sort((a, b) => a.x - b.x);
      return row.cells.map((c) => c.text).join("\t");
    })
    .join("\n");
}

/** Extracts plain text lines from a PDF ArrayBuffer using pdf-lib stream decoding. */
export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } = await import("pdf-lib");
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pageTexts: string[] = [];

  for (const page of doc.getPages()) {
    const contents = page.node.get(PDFName.of("Contents"));
    if (!contents) continue;
    const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
    let combinedStream = "";

    for (const ref of refs) {
      const resolved = doc.context.lookup(ref);
      if (!(resolved instanceof PDFRawStream)) continue;
      let bytes: Uint8Array;
      try {
        bytes = decodePDFRawStream(resolved).decode();
      } catch {
        bytes = resolved.contents;
      }
      combinedStream += `${new TextDecoder("latin1").decode(bytes)}\n`;
    }

    const pageText = extractTextFromPdfContentStream(combinedStream);
    if (pageText) pageTexts.push(pageText);
  }

  return pageTexts.join("\n");
}

/** Reads XLSX/XLS/CSV/TSV/TXT/PDF files into requirement items without assuming null/missing values. */
export async function readRequirementFile(file: File): Promise<ParsedRequirementItem[]> {
  if (file.size === 0) {
    throw new Error(`"${file.name}" is empty (0 bytes). Please upload a valid XLSX, CSV, PDF, or TXT file.`);
  }

  if (/\.(xlsx|xlsm|xls)$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
    for (const sheetName of book.SheetNames) {
      const sheet = book.Sheets[sheetName];
      if (!sheet) continue;
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      const rows = matrix.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
      const parsed = parseRequirementRows(rows);
      if (parsed.length) return parsed;
    }
    return [];
  }

  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    const text = await extractPdfText(await file.arrayBuffer());
    if (!text.trim()) {
      throw new Error(`No readable text was found in "${file.name}". Scanned/image-only PDFs are not supported — upload a text-based PDF, XLSX, or CSV.`);
    }
    return parseRequirementText(text);
  }

  const text = await file.text();
  if (!text.trim()) {
    throw new Error(`"${file.name}" contains no readable data.`);
  }
  return parseRequirementText(text);
}
