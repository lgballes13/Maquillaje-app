import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { formatCop } from "@/modules/booking/policy";
import { PreorderForm } from "@/modules/shop/components/preorder-form";
import { getMyCredit, getProduct, getShopRules } from "@/modules/shop/queries";

export const metadata: Metadata = { title: "Reservar producto", robots: { index: false } };

export default async function ReservePage({ params }: PageProps<"/tienda/[productoId]/reservar">) {
  const { productoId } = await params;
  if (!z.uuid().safeParse(productoId).success) notFound();
  const user = await requireUser(`/tienda/${productoId}/reservar`);
  const product = await getProduct(productoId);
  if (!product) notFound();
  // Si hay unidades, se compra normal; si no se puede reservar, se vuelve al producto.
  if (product.available > 0 || !product.allowPreorder) redirect(`/tienda/${product.id}`);

  const supabase = await createClient();
  const [rules, credit, { data: profile }] = await Promise.all([
    getShopRules(),
    getMyCredit(),
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link
        href={`/tienda/${product.id}`}
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
      >
        Volver al producto
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Reservar {product.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatCop(product.priceCop)} c/u · IVA incluido · llega en unos{" "}
        {rules.preorder_delivery_days} días
      </p>
      <PreorderForm
        productId={product.id}
        priceCop={product.priceCop}
        creditCop={credit}
        defaultName={profile?.full_name ?? ""}
        defaultPhone={profile?.phone ?? ""}
        rules={{
          version: rules.version,
          depositPercent: Number(rules.preorder_deposit_percent),
          deliveryDays: rules.preorder_delivery_days,
          balanceDays: rules.preorder_balance_days,
          creditValidityDays: rules.credit_validity_days,
          holdMinutes: rules.booking_hold_minutes,
          shippingFeeCop: rules.shipping_fee_cop,
        }}
      />
    </main>
  );
}
