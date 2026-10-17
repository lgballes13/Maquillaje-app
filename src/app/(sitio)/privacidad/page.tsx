import type { Metadata } from "next";
import { PRIVACY_POLICY_VERSION } from "@/config/legal";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Política de tratamiento de datos" };

// BORRADOR: el texto definitivo se redacta en la Fase 8 y debe revisarlo un abogado.
export default function PrivacyPage() {
  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">
        Política de tratamiento de datos personales
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Versión {PRIVACY_POLICY_VERSION} · Borrador pendiente de revisión legal.
      </p>

      <div className="mt-6 grid gap-4 text-base leading-relaxed">
        <p>
          {siteConfig.name} trata tus datos personales conforme a la Ley 1581 de 2012 y el Decreto
          1377 de 2013.
        </p>
        <h2 className="text-lg font-semibold">¿Para qué usamos tus datos?</h2>
        <ul className="list-disc pl-6">
          <li>Crear y administrar tu cuenta.</li>
          <li>Agendar tus citas y enviarte confirmaciones y recordatorios.</li>
          <li>Procesar tus compras, pagos y entregas.</li>
          <li>Enviarte promociones, solo si lo autorizas.</li>
        </ul>
        <h2 className="text-lg font-semibold">Tus derechos</h2>
        <p>
          Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar esta autorización
          en cualquier momento. Muy pronto podrás eliminar tu cuenta desde «Mi cuenta».
        </p>
      </div>
    </main>
  );
}
