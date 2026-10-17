import type { Metadata } from "next";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/modules/auth/actions";
import { requireUser } from "@/modules/auth/session";
import { formatCop } from "@/modules/booking/policy";
import { getMyCreditBalance } from "@/modules/booking/queries";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

export default async function AccountPage({ searchParams }: PageProps<"/cuenta">) {
  const user = await requireUser("/cuenta");
  const params = await searchParams;

  // RLS garantiza que esta consulta solo puede devolver el perfil propio.
  const supabase = await createClient();
  const [{ data: profile }, credit] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, privacy_accepted_at")
      .eq("id", user.id)
      .single(),
    getMyCreditBalance(),
  ]);

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
        aria-labelledby="titulo-citas"
        className="mt-6 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-citas" className="text-lg font-semibold">
          Tus citas
        </h2>
        <p className="mt-2 text-sm">
          Saldo a favor: <strong data-testid="credit-balance">{formatCop(credit)}</strong>
          {credit > 0 ? (
            <span className="block text-muted-foreground">
              Se aplica solo al anticipo de tu próxima cita.
            </span>
          ) : null}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/cuenta/citas" className={buttonVariants({ variant: "outline" })}>
            Ver mis citas
          </Link>
          <Link href="/agendar" className={buttonVariants()}>
            Agendar una cita
          </Link>
        </div>
      </section>

      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="outline">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}
