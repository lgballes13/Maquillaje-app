import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/modules/auth/actions";
import { requireUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

export default async function AccountPage({ searchParams }: PageProps<"/cuenta">) {
  const user = await requireUser("/cuenta");
  const params = await searchParams;

  // RLS garantiza que esta consulta solo puede devolver el perfil propio.
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, privacy_accepted_at")
    .eq("id", user.id)
    .single();

  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">
        Hola, {profile?.full_name ?? "bienvenida"}
      </h1>

      {params.clave === "actualizada" ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-emerald-700/30 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          Tu contraseña se actualizó correctamente.
        </p>
      ) : null}

      <section
        aria-labelledby="titulo-datos"
        className="mt-6 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-datos" className="text-lg font-semibold">
          Tus datos
        </h2>
        <dl className="mt-3 grid gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Correo</dt>
            <dd className="font-medium break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Celular</dt>
            <dd className="font-medium">{profile?.phone ?? "Sin registrar"}</dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="titulo-proximamente"
        className="mt-6 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-proximamente" className="text-lg font-semibold">
          Tus citas y pedidos
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">Muy pronto podrás verlos aquí.</p>
      </section>

      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="outline">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}
