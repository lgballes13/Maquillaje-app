import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { legalValue, TERMS_VERSION } from "@/config/legal";
import { siteConfig } from "@/config/site";
import { policyPoints } from "@/modules/booking/policy";
import { getCurrentRules } from "@/modules/booking/queries";
import { preorderTerms, purchaseTerms } from "@/modules/shop/labels";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: `Condiciones de las citas, la tienda y las preventas de ${siteConfig.name}.`,
  alternates: { canonical: "/terminos" },
};

// BORRADOR: debe revisarlo un abogado antes de publicar el sitio (ver docs/publicacion.md).
// Los plazos y porcentajes salen de las reglas vigentes del panel, igual que al reservar.
export default async function TermsPage() {
  const rules = await getCurrentRules();
  const email = legalValue(siteConfig.contactEmail);
  const linkClass = "font-medium text-primary underline underline-offset-4";

  return (
    <LegalPage title="Términos y condiciones" version={TERMS_VERSION}>
      <p>
        Estos términos aplican a las citas, compras y preventas que hagas en este sitio. Al reservar
        o comprar los aceptas, junto con la{" "}
        <Link href="/privacidad" className={linkClass}>
          política de tratamiento de datos
        </Link>
        . Se rigen por las leyes de Colombia, en especial el Estatuto del Consumidor (Ley 1480 de
        2011).
      </p>

      <h2>1. Quiénes somos</h2>
      <ul>
        <li>Nombre: {siteConfig.name}</li>
        <li>Identificación: {legalValue(siteConfig.legalId)}</li>
        <li>Dirección: {legalValue(siteConfig.address)}</li>
        <li>Correo para preguntas, quejas y reclamos: {email}</li>
        {siteConfig.whatsappNumber ? <li>WhatsApp: +{siteConfig.whatsappNumber}</li> : null}
      </ul>

      <h2>2. Precios y pagos</h2>
      <p>
        Los precios están en pesos colombianos e incluyen IVA. Los pagos en línea los procesa Wompi;
        no guardamos los datos de tu tarjeta. El precio que pagas es el que viste al confirmar.
      </p>

      <h2>3. Citas</h2>
      <ul>
        {policyPoints(rules).map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <p>
        Al reservar aceptas estas condiciones y queda guardada la versión que aceptaste: si después
        cambian, a tu cita le aplica la que aceptaste.
      </p>

      <h2>4. Compras en la tienda</h2>
      <ul>
        {purchaseTerms(rules.booking_hold_minutes).map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>

      <h2>5. Preventas</h2>
      <ul>
        {preorderTerms({
          depositPercent: Number(rules.preorder_deposit_percent),
          deliveryDays: rules.preorder_delivery_days,
          balanceDays: rules.preorder_balance_days,
          creditValidityDays: rules.credit_validity_days,
          holdMinutes: rules.booking_hold_minutes,
        }).map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>

      <h2>6. Derecho de retracto</h2>
      <p>
        En compras a distancia puedes retractarte dentro de los 5 días hábiles siguientes a la
        entrega (artículo 47 de la Ley 1480). Escríbenos a {email}; devuelves el producto sin usar,
        en su empaque y con su sello, y te devolvemos todo lo pagado dentro de los 30 días
        calendario siguientes. Por higiene, los productos de uso personal abiertos o sin sello no
        tienen retracto. El retracto no aplica a los servicios de maquillaje ya prestados.
      </p>

      <h2>7. Garantía</h2>
      <p>
        Los productos tienen la garantía legal: si llegan con un defecto o no corresponden a lo que
        compraste, te los cambiamos o te devolvemos el dinero. Si el servicio de maquillaje no
        cumple lo acordado, escríbenos y lo revisamos contigo.
      </p>

      <h2>8. Reversión del pago</h2>
      <p>
        Si pagaste con tarjeta u otro medio electrónico y fuiste víctima de fraude, la operación no
        fue solicitada, el producto no llegó o llegó defectuoso, puedes pedir la reversión del pago
        dentro de los 5 días hábiles siguientes a que conociste el problema o recibiste el producto
        (artículo 51 de la Ley 1480). Avísanos a {email} y al emisor de tu medio de pago.
      </p>

      <h2>9. Preguntas, quejas y reclamos</h2>
      <p>
        Escríbenos a {email}
        {siteConfig.whatsappNumber ? " o por WhatsApp" : ""}. Respondemos en máximo 15 días hábiles.
        Si no quedas satisfecha, puedes acudir a la Superintendencia de Industria y Comercio.
      </p>

      <h2>10. Cambios</h2>
      <p>
        Podemos actualizar estos términos. Los cambios no afectan las citas ni las compras que ya
        hiciste.
      </p>
    </LegalPage>
  );
}
