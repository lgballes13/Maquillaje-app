import { MessageCircle } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/utils";

interface WhatsAppButtonProps {
  phone?: string;
  message?: string;
}

/**
 * Botón flotante de WhatsApp (esquina inferior derecha).
 * Si no hay número configurado no se muestra nada.
 */
export function WhatsAppButton({ phone, message }: WhatsAppButtonProps) {
  if (!phone) return null;

  return (
    <a
      href={buildWhatsAppUrl(phone, message)}
      target="_blank"
      // noopener/noreferrer: la pestaña nueva no puede controlar la nuestra.
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp (se abre en una pestaña nueva)"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 inline-flex size-14 items-center justify-center rounded-full bg-[#1f7a3d] text-white shadow-lg transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-[#1f7a3d]/40 focus-visible:outline-none"
    >
      <MessageCircle aria-hidden="true" className="size-7" />
    </a>
  );
}
