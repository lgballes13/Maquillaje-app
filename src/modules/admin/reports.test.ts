import { describe, expect, it } from "vitest";
import { attendanceRate, reportSchema, resolveReportRange, totalIncome } from "./reports";
import { customerNoteSchema, resolveCustomerSearch } from "./customers";

describe("resolveReportRange", () => {
  it("por defecto va del 1 del mes hasta hoy", () => {
    expect(resolveReportRange({}, "2026-10-17")).toEqual({ from: "2026-10-01", to: "2026-10-17" });
  });

  it("acepta un rango válido", () => {
    expect(resolveReportRange({ desde: "2026-01-01", hasta: "2026-03-31" }, "2026-10-17")).toEqual({
      from: "2026-01-01",
      to: "2026-03-31",
    });
  });

  it("rechaza rangos al revés, incompletos o de más de un año", () => {
    expect(
      resolveReportRange({ desde: "2026-03-01", hasta: "2026-01-01" }, "2026-10-17").error,
    ).toBe("La fecha final no puede ser antes de la inicial.");
    expect(resolveReportRange({ desde: "2026-03-01" }, "2026-10-17").error).toBeDefined();
    expect(
      resolveReportRange({ desde: "2024-01-01", hasta: "2026-01-01" }, "2026-10-17").error,
    ).toBe("El rango puede ser de máximo un año.");
  });
});

describe("reporte", () => {
  const report = reportSchema.parse({
    income: {
      appointment_deposits_cop: 180000,
      shop_cop: 135000,
      preorder_deposits_cop: 0,
      preorder_balances_cop: 20000,
    },
    appointments_by_status: { completed: 3, no_show: 1, confirmed: 2 },
    top_products: [{ name: "Labial", quantity: 2, total_cop: 90000 }],
    credit_outstanding_cop: 25000,
  });

  it("suma los ingresos", () => {
    expect(totalIncome(report)).toBe(335000);
  });

  it("calcula la asistencia sobre las citas ya marcadas", () => {
    expect(attendanceRate(report.appointments_by_status)).toBe(75);
    expect(attendanceRate({ confirmed: 2 })).toBeNull();
  });
});

describe("clientas", () => {
  it("limpia la búsqueda", () => {
    expect(resolveCustomerSearch("  ana ")).toBe("ana");
    expect(resolveCustomerSearch(["ana"])).toBe("");
    expect(resolveCustomerSearch("x".repeat(300))).toHaveLength(100);
  });

  it("la nota interna tiene un límite", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(customerNoteSchema.safeParse({ customerId: id, note: "Piel sensible" }).success).toBe(
      true,
    );
    expect(customerNoteSchema.safeParse({ customerId: id, note: "x".repeat(2001) }).success).toBe(
      false,
    );
    expect(customerNoteSchema.safeParse({ customerId: "x", note: "" }).success).toBe(false);
  });
});
