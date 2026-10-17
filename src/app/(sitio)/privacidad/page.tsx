import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { HABEAS_DATA_DAYS, legalValue, PRIVACY_POLICY_VERSION } from "@/config/legal";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Política de tratamiento de datos",
  description: `Cómo ${siteConfig.name} usa y protege tus datos personales (Ley 1581 de 2012).`,
  alternates: { canonical: "/privacidad" },
};

// BORRADOR: debe revisarlo un abogado antes de publicar el sitio (ver docs/publicacion.md).
export default function PrivacyPage() {
  const email = legalValue(siteConfig.contactEmail);

  return (
    <LegalPage title="Política de tratamiento de datos personales" version={PRIVACY_POLICY_VERSION}>
      <p>
        Esta política explica cómo {siteConfig.name} recolecta, usa, guarda y protege tus datos
        personales, conforme a la Ley 1581 de 2012, el Decreto 1074 de 2015 y demás normas que las
        modifiquen.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <ul>
        <li>Nombre: {siteConfig.name}</li>
        <li>Identificación: {legalValue(siteConfig.legalId)}</li>
        <li>Dirección: {legalValue(siteConfig.address)}</li>
        <li>Correo para temas de datos personales: {email}</li>
        {siteConfig.whatsappNumber ? <li>WhatsApp: +{siteConfig.whatsappNumber}</li> : null}
      </ul>

      <h2>2. Qué datos recolectamos</h2>
      <ul>
        <li>Datos de contacto: nombre, correo y celular.</li>
        <li>Datos de entrega: nombre de quien recibe, dirección, ciudad y teléfono.</li>
        <li>Historial de citas, compras, pagos y saldo a favor.</li>
        <li>Las notas que escribes al reservar (por ejemplo, la hora de tu evento).</li>
        <li>
          Fotos de tu maquillaje, solo si firmas una autorización aparte para publicarlas en el
          portafolio.
        </li>
      </ul>
      <p>
        No guardamos los datos de tu tarjeta: el pago lo procesa Wompi en su propia página. Las
        cookies que usamos son solo las necesarias para mantener tu sesión y tu carrito.
      </p>

      <h2>3. Datos sensibles</h2>
      <p>
        Información sobre tu piel, alergias o salud y las fotos de tu rostro son datos sensibles. No
        estás obligada a darlos; si nos los cuentas, los usamos solo para atenderte de forma segura.
        Las fotos solo se publican con tu autorización firmada y puedes retirarla en cualquier
        momento: el trabajo deja de mostrarse y sus fotos se borran.
      </p>

      <h2>4. Para qué usamos tus datos</h2>
      <ul>
        <li>Crear y administrar tu cuenta.</li>
        <li>Agendar tus citas y enviarte confirmaciones, recordatorios y cambios.</li>
        <li>Procesar tus compras, pagos, preventas, entregas y devoluciones.</li>
        <li>Avisarte cuando vuelva un producto, si te inscribes en la lista de espera.</li>
        <li>Atender tus preguntas, quejas y solicitudes.</li>
        <li>Cumplir obligaciones legales, contables y tributarias.</li>
        <li>Enviarte novedades y promociones, solo si lo autorizaste al registrarte.</li>
      </ul>

      <h2>5. Quién más trata tus datos</h2>
      <p>
        Usamos proveedores que guardan o procesan datos por encargo nuestro y bajo nuestras
        instrucciones: Supabase (base de datos y archivos), Vercel (alojamiento del sitio), Wompi
        (pagos), Resend (envío de correos) y Sentry (errores técnicos, sin datos personales).
        Algunos tienen sus servidores fuera de Colombia, por lo que tus datos pueden transmitirse a
        otros países con niveles adecuados de protección según la Superintendencia de Industria y
        Comercio. No vendemos ni compartimos tus datos con fines comerciales.
      </p>

      <h2>6. Tus derechos</h2>
      <ul>
        <li>Conocer, actualizar y rectificar tus datos.</li>
        <li>Pedir prueba de la autorización que nos diste.</li>
        <li>Saber cómo hemos usado tus datos.</li>
        <li>Revocar la autorización o pedir que borremos tus datos.</li>
        <li>
          Presentar quejas ante la Superintendencia de Industria y Comercio, después de haber hecho
          tu reclamo ante nosotros.
        </li>
        <li>Acceder gratis a tus datos.</li>
      </ul>

      <h2>7. Cómo ejercerlos</h2>
      <p>
        Desde{" "}
        <Link href="/cuenta" className="font-medium text-primary underline underline-offset-4">
          Mi cuenta
        </Link>{" "}
        puedes descargar una copia de tus datos y eliminar tu cuenta. Para cualquier otra solicitud
        escríbenos a {email} con tu nombre, tu correo registrado y lo que necesitas.
      </p>
      <ul>
        <li>
          Consultas: respondemos en máximo {HABEAS_DATA_DAYS.query} días hábiles (prorrogables{" "}
          {HABEAS_DATA_DAYS.queryExtension} días más, avisándote el motivo).
        </li>
        <li>
          Reclamos (corregir, actualizar o borrar): respondemos en máximo {HABEAS_DATA_DAYS.claim}{" "}
          días hábiles (prorrogables {HABEAS_DATA_DAYS.claimExtension} días más, avisándote el
          motivo).
        </li>
      </ul>

      <h2>8. Cuánto tiempo los guardamos</h2>
      <p>
        Mientras tengas tu cuenta. Si la eliminas, borramos tus datos de contacto; los registros de
        citas, compras y pagos se conservan sin tus datos de contacto durante el tiempo que exigen
        las normas contables y tributarias.
      </p>

      <h2>9. Seguridad</h2>
      <p>
        Tu información viaja cifrada, cada persona solo puede ver sus propios datos y el panel de
        administración exige verificación en dos pasos. Ningún sistema es infalible: si llegamos a
        tener un incidente que afecte tus datos, te avisaremos y lo informaremos a la
        Superintendencia de Industria y Comercio.
      </p>

      <h2>10. Menores de edad</h2>
      <p>
        Para crear una cuenta debes ser mayor de 18 años. Las citas de menores las agenda y autoriza
        su madre, padre o representante legal.
      </p>

      <h2>11. Cambios y vigencia</h2>
      <p>
        Esta política rige desde el {PRIVACY_POLICY_VERSION}. Si la cambiamos de forma importante,
        te avisaremos por correo o en el sitio antes de aplicar los cambios.
      </p>
    </LegalPage>
  );
}
