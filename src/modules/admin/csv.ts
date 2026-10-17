/*
 * Archivos CSV para abrir en Excel o Google Sheets.
 * - Separador «;» y BOM UTF-8: así Excel en español los abre con tildes y en columnas.
 * - Una celda que empieza por = + - @ (o tabulador / salto) se antepone con «'»
 *   para que la hoja de cálculo no la ejecute como fórmula (inyección CSV).
 */

export const CSV_SEPARATOR = ";";
const FORMULA_START = /^[=+\-@\t\r]/;

export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(text) || text !== text.trim() ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(CSV_SEPARATOR));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Nombre de archivo seguro, ej.: "citas_2026-10-01_2026-10-31.csv". */
export function csvFileName(kind: string, ...parts: string[]): string {
  const safe = [kind, ...parts].map((p) => p.replace(/[^\w-]+/g, "-")).filter(Boolean);
  return `${safe.join("_")}.csv`;
}
