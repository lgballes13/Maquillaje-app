"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/** Botón de envío que se desactiva y cambia el texto mientras el servidor responde. */
export function SubmitButton({
  children,
  pendingText = "Enviando…",
  className,
  variant,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      aria-disabled={pending}
      className={className}
    >
      {pending ? pendingText : children}
    </Button>
  );
}
