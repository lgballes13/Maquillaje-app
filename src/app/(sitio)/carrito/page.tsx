import type { Metadata } from "next";
import { getCurrentUser } from "@/modules/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CartView } from "@/modules/shop/components/cart-view";

export const metadata: Metadata = { title: "Carrito", robots: { index: false } };

export default async function CartPage() {
  const user = await getCurrentUser();
  let defaultName = "";
  let defaultPhone = "";
  if (user) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle();
    defaultName = profile?.full_name ?? "";
    defaultPhone = profile?.phone ?? "";
  }

  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Tu carrito</h1>
      <CartView signedIn={Boolean(user)} defaultName={defaultName} defaultPhone={defaultPhone} />
    </main>
  );
}
