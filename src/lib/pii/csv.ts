import Papa from "papaparse";
import {
  createEmptyCategoryCounts,
  createPseudonymSession,
  sanitizeDocumentText,
} from "./sanitizer";
import {
  ALL_PII_CATEGORIES,
  CsvCellHighlight,
  CsvSanitizationResult,
  PiiCategory,
  RedactionMode,
} from "./types";

/**
 * Parses and sanitizes CSV files in-browser using PapaParse.
 * Preserves headers, row/column order, quoted fields, escaped quotes,
 * commas inside quotes, multiline cells, and empty cells.
 */
export function sanitizeCsvDocument(
  csvText: string,
  options: {
    mode: RedactionMode;
    enabledCategories?: PiiCategory[];
  }
): CsvSanitizationResult {
  const startMs = performance.now();
  const enabledCategories = options.enabledCategories ?? ALL_PII_CATEGORIES;

  if (!csvText.trim()) {
    return {
      headers: [],
      originalRows: [],
      sanitizedRows: [],
      serializedCsv: "",
      cellResults: [],
      mode: options.mode,
      enabledCategories,
      summary: {
        totalDetections: 0,
        uniqueEntities: 0,
        categoryCounts: createEmptyCategoryCounts(),
        luhnValidCards: 0,
        luhnInvalidCandidates: 0,
        aadhaarValidFormat: 0,
        durationMs: 1,
      },
      rowCount: 0,
      columnCount: 0,
    };
  }

  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: false,
  });

  // Remove a trailing empty line produced by a final newline if it has 1 empty cell
  const rawMatrix = parsed.data.filter((row, index) => {
    if (index === parsed.data.length - 1 && row.length === 1 && row[0] === "") {
      return false;
    }
    return true;
  });

  if (rawMatrix.length === 0) {
    return {
      headers: [],
      originalRows: [],
      sanitizedRows: [],
      serializedCsv: "",
      cellResults: [],
      mode: options.mode,
      enabledCategories,
      summary: {
        totalDetections: 0,
        uniqueEntities: 0,
        categoryCounts: createEmptyCategoryCounts(),
        luhnValidCards: 0,
        luhnInvalidCandidates: 0,
        aadhaarValidFormat: 0,
        durationMs: 1,
      },
      rowCount: 0,
      columnCount: 0,
    };
  }

  const headers = rawMatrix[0].map((cell) => String(cell ?? ""));
  const bodyRows = rawMatrix.slice(1).map((row) => row.map((cell) => String(cell ?? "")));

  const session = createPseudonymSession();
  const uniqueSet = new Set<string>();
  const categoryCounts = createEmptyCategoryCounts();
  let totalDetections = 0;
  let luhnValidCards = 0;
  let luhnInvalidCandidates = 0;
  let aadhaarValidFormat = 0;

  const cellResults: CsvCellHighlight[] = [];
  const sanitizedRows: string[][] = bodyRows.map((row, rowIndex) =>
    row.map((cell, colIndex) => {
      if (!cell) return "";
      const res = sanitizeDocumentText(cell, {
        mode: options.mode,
        enabledCategories,
        session,
        uniqueSet,
      });

      if (res.entities.length > 0) {
        cellResults.push({
          rowIndex,
          colIndex,
          originalValue: cell,
          sanitizedValue: res.sanitizedText,
          entities: res.entities,
        });
      }

      totalDetections += res.summary.totalDetections;
      luhnValidCards += res.summary.luhnValidCards;
      luhnInvalidCandidates += res.summary.luhnInvalidCandidates;
      aadhaarValidFormat += res.summary.aadhaarValidFormat;
      for (const cat of ALL_PII_CATEGORIES) {
        categoryCounts[cat] += res.summary.categoryCounts[cat];
      }

      return res.sanitizedText;
    })
  );

  // Serialize back to CSV preserving quotes, commas inside quotes, escaped quotes, and multiline values
  const serializedCsv = Papa.unparse(
    {
      fields: headers,
      data: sanitizedRows,
    },
    {
      quotes: false,
      quoteChar: '"',
      escapeChar: '"',
      newline: "\n",
    }
  );

  const durationMs = Math.max(1, Math.round(performance.now() - startMs));

  return {
    headers,
    originalRows: bodyRows,
    sanitizedRows,
    serializedCsv,
    cellResults,
    mode: options.mode,
    enabledCategories,
    summary: {
      totalDetections,
      uniqueEntities: uniqueSet.size,
      categoryCounts,
      luhnValidCards,
      luhnInvalidCandidates,
      aadhaarValidFormat,
      durationMs,
    },
    rowCount: bodyRows.length,
    columnCount: headers.length,
  };
}
