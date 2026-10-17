import { describe, expect, it } from "vitest";
import { csvCell, csvFileName, toCsv } from "./csv";

describe("csvCell", () => {
  it("deja el texto simple como está", () => {
    expect(csvCell("Ana Gómez")).toBe("Ana Gómez");
    expect(csvCell(90000)).toBe("90000");
    expect(csvCell(null)).toBe("");
    expect(csvCell(true)).toBe("Sí");
  });

  it("encierra en comillas lo que tiene separador, comillas o saltos de línea", () => {
    expect(csvCell("Calle 1; apto 2")).toBe('"Calle 1; apto 2"');
    expect(csvCell('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(csvCell("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
  });

  it("neutraliza fórmulas para que Excel no las ejecute", () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("+573001234567")).toBe("'+573001234567");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
});

describe("toCsv", () => {
  it("arma el archivo con BOM, «;» y fin de línea de Windows", () => {
    expect(toCsv(["Nombre", "Total"], [["Ana", 1000]])).toBe("﻿Nombre;Total\r\nAna;1000\r\n");
  });
});

describe("csvFileName", () => {
  it("solo deja letras, números y guiones", () => {
    expect(csvFileName("citas", "2026-10-01", "2026-10-31")).toBe(
      "citas_2026-10-01_2026-10-31.csv",
    );
    expect(csvFileName("clientas", "../ana gómez")).toBe("clientas_-ana-g-mez.csv");
  });
});
