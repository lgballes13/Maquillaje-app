import { describe, expect, it } from "vitest";
import { pickCover, portfolioErrorMessage } from "./labels";

describe("pickCover", () => {
  it("elige la primera foto de antes y la primera de después según el orden", () => {
    const images = [
      { kind: "after" as const, sort_order: 2, id: "d2" },
      { kind: "before" as const, sort_order: 1, id: "a1" },
      { kind: "after" as const, sort_order: 0, id: "d0" },
    ];
    expect(pickCover(images)).toEqual({
      before: { kind: "before", sort_order: 1, id: "a1" },
      after: { kind: "after", sort_order: 0, id: "d0" },
    });
  });

  it("sin foto de antes devuelve null", () => {
    expect(pickCover([{ kind: "after" as const, sort_order: 0 }]).before).toBeNull();
  });
});

describe("portfolioErrorMessage", () => {
  it("explica por qué no se puede publicar", () => {
    expect(portfolioErrorMessage("consent_required")).toMatch(/autorización vigente/);
    expect(portfolioErrorMessage("after_photo_required")).toMatch(/después/);
    expect(portfolioErrorMessage("otro")).toMatch(/Intenta de nuevo/);
  });
});
