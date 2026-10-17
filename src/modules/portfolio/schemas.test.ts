import { describe, expect, it } from "vitest";
import {
  consentSchema,
  detectDocumentType,
  revokeConsentSchema,
  todayInBogota,
  workImageSchema,
  workSchema,
} from "./schemas";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("todayInBogota", () => {
  it("usa la fecha de Colombia, no la del servidor", () => {
    // 2 a. m. UTC del 18 = 9 p. m. del 17 en Bogotá.
    expect(todayInBogota(new Date("2026-10-18T02:00:00Z"))).toBe("2026-10-17");
    expect(todayInBogota(new Date("2026-10-18T06:00:00Z"))).toBe("2026-10-18");
  });
});

describe("consentSchema", () => {
  it("acepta el nombre y una fecha pasada, y deja las notas vacías como null", () => {
    expect(
      consentSchema.parse({ clientName: "  Laura Gómez ", signedOn: "2026-10-01", notes: "" }),
    ).toEqual({ clientName: "Laura Gómez", signedOn: "2026-10-01", notes: null });
  });

  it("rechaza una fecha futura, una fecha mal escrita y un nombre muy corto", () => {
    expect(consentSchema.safeParse({ clientName: "Laura", signedOn: "2999-01-01" }).success).toBe(
      false,
    );
    expect(consentSchema.safeParse({ clientName: "Laura", signedOn: "01/10/2026" }).success).toBe(
      false,
    );
    expect(consentSchema.safeParse({ clientName: "La", signedOn: "2026-10-01" }).success).toBe(
      false,
    );
  });
});

describe("revokeConsentSchema", () => {
  it("exige el motivo", () => {
    expect(revokeConsentSchema.safeParse({ consentId: A, reason: "" }).success).toBe(false);
    expect(revokeConsentSchema.parse({ consentId: A, reason: "Lo pidió" }).reason).toBe("Lo pidió");
  });
});

describe("workSchema", () => {
  it("convierte los vacíos en null y el orden en número", () => {
    expect(
      workSchema.parse({
        title: "Novia en el jardín",
        description: "",
        category_id: "",
        service_id: "",
        consent_id: A,
        sort_order: "3",
      }),
    ).toEqual({
      title: "Novia en el jardín",
      description: null,
      category_id: null,
      service_id: null,
      consent_id: A,
      sort_order: 3,
    });
  });

  it("no acepta publicar desde el formulario: lo ignora", () => {
    const result = workSchema.parse({ title: "Social", sort_order: "0", is_published: "on" });
    expect(result).not.toHaveProperty("is_published");
  });
});

describe("workImageSchema", () => {
  it("solo acepta fotos de antes o de después", () => {
    expect(workImageSchema.safeParse({ workId: A, kind: "after", altText: "Novia" }).success).toBe(
      true,
    );
    expect(workImageSchema.safeParse({ workId: A, kind: "otra", altText: "Novia" }).success).toBe(
      false,
    );
  });
});

describe("detectDocumentType", () => {
  it("reconoce PDF y fotos por sus primeros bytes", () => {
    expect(detectDocumentType(new TextEncoder().encode("%PDF-1.7 ..."))?.ext).toBe("pdf");
    expect(detectDocumentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
  });

  it("rechaza otros archivos aunque se llamen .pdf", () => {
    expect(detectDocumentType(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(detectDocumentType(new TextEncoder().encode("%PD"))).toBeNull();
  });
});
