"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Botón de envío que se desactiva y cambia el texto mientras el servidor responde. */
export function SubmitButton({
  children,
  pendingText = "Enviando…",
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} className={className}>
      {pending ? pendingText : children}
    </Button>
  );
}
