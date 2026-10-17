import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { formatFullDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { APPOINTMENT_STATUS_LABELS, displayStatus } from "@/modules/booking/policy";

export const metadata: Metadata = { title: "Mis citas", robots: { index: false } };

export default async function MyAppointmentsPage() {
  await requireUser("/cuenta/citas");
  const supabase = await createClient();
  // RLS: solo devuelve las citas de la clienta que tiene la sesión.
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, service_name, starts_at, status, hold_expires_at")
    .order("starts_at", { ascending: false })
    .limit(50);

  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Mis citas</h1>

      {!appointments?.length ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <p className="text-muted-foreground">Todavía no tienes citas.</p>
          <Link href="/agendar" className={buttonVariants({ className: "mt-4" })}>
            Agendar una cita
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {appointments.map((a) => {
            const status = displayStatus(a);
            return (
              <li key={a.id}>
                <Link
                  href={`/citas/${a.id}`}
                  className="block min-h-11 rounded-xl border border-border bg-card p-4 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="block font-semibold">{a.service_name}</span>
                  <span className="block text-sm first-letter:uppercase">
                    {formatFullDateTime(a.starts_at)}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {APPOINTMENT_STATUS_LABELS[status]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
