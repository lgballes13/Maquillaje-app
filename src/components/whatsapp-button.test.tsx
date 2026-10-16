import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WhatsAppButton } from "./whatsapp-button";

describe("WhatsAppButton", () => {
  it("no se muestra si no hay número configurado", () => {
    const { container } = render(<WhatsAppButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra un enlace accesible y seguro hacia WhatsApp", () => {
    render(<WhatsAppButton phone="573001234567" message="Hola" />);
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link).toHaveAttribute("href", "https://wa.me/573001234567?text=Hola");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
