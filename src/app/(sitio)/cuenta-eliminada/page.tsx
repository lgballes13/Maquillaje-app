import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cuenta eliminada", robots: { index: false } };

export default function AccountClosedPage() {
  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Eliminamos tu cuenta</h1>
      <p className="mt-4">
        Borramos tus datos de contacto y cerramos tu sesión. Las citas y compras que hiciste se
        conservan sin tu nombre ni tus datos de contacto, porque la ley nos pide guardar los
        registros contables.
      </p>
      <p className="mt-4">Gracias por haber confiado en nosotros.</p>
      <Link href="/" className={`${buttonVariants({ variant: "outline" })} mt-6`}>
        Volver al inicio
      </Link>
    </main>
  );
}
