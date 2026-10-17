import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { formatClock, formatFullDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { requireUser } from "@/modules/auth/session";
import {
  APPOINTMENT_STATUS_LABELS,
  bookingErrorMessage,
  displayStatus,
  formatCop,
  formatDuration,
} from "@/modules/booking/policy";
import { applyWompiTransaction, getWompiConfig } from "@/modules/payments/service";
import {
  checkoutFields,
  fetchWompiTransaction,
  WOMPI_CHECKOUT_URL,
} from "@/modules/payments/wompi";

export const metadata: Metadata = { title: "Tu cita", robots: { index: false } };

const STATUS_STYLES = {
  pending_payment: "border-amber-700/30 bg-amber-50 text-amber-900",
  confirmed: "border-emerald-700/30 bg-emerald-50 text-emerald-900",
  expired: "border-border bg-muted text-muted-foreground",
  cancelled: "border-border bg-muted text-muted-foreground",
} as const;

async function loadAppointment(id: string) {
  const supabase = await createClient();
  // RLS: solo devuelve la cita si es de la clienta (o si es admin).
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, service_name, duration_minutes, price_cop, deposit_cop, deposit_percent, rules_version, starts_at, status, hold_expires_at, customer_notes",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

/**
 * Wompi devuelve a la clienta con ?id=<transacción>. Si el webhook aún no ha
 * llegado, consultamos la transacción directo en Wompi y la aplicamos.
 */
async function reconcileFromRedirect(appointmentId: string, transactionId: string) {
  const config = getWompiConfig();
  if (!config) return;
  const transaction = await fetchWompiTransaction(config.mode, transactionId);
  if (!transaction) return;

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("reference", transaction.reference)
    .maybeSingle();
  // Solo se aplica si la transacción corresponde a un pago de ESTA cita.
  if (!payment) return;

  try {
    await applyWompiTransaction("api", transaction);
  } catch (error) {
    console.error(error);
  }
}

export default async function AppointmentPage({ params, searchParams }: PageProps<"/citas/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser(`/citas/${id}`);

  let appointment = await loadAppointment(id);
  if (!appointment) notFound();

  const transactionId = typeof query.id === "string" ? query.id : undefined;
  if (transactionId && appointment.status !== "confirmed") {
    await reconcileFromRedirect(id, transactionId);
    appointment = (await loadAppointment(id)) ?? appointment;
  }

  const supabase = await createClient();
  const { data: lastPayment } = await supabase
    .from("payments")
    .select("status, provider_transaction_id")
    .eq("appointment_id", id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Datos del botón de pago (solo si la cita espera el anticipo).
  const wompi = getWompiConfig();
  let checkout: Record<string, string> | null = null;
  let paymentError: string | null = null;
  if (appointment.status === "pending_payment") {
    if (!wompi) {
      paymentError = "Los pagos en línea todavía no están activos. Escríbenos por WhatsApp.";
    } else {
      const { data, error } = await supabase.rpc("prepare_appointment_payment", {
        p_appointment_id: id,
      });
      const attempt = data?.[0];
      if (error || !attempt) {
        paymentError = bookingErrorMessage(error?.message);
      } else {
        checkout = checkoutFields({
          publicKey: wompi.publicKey,
          integritySecret: wompi.integritySecret,
          reference: attempt.reference,
          amountInCents: attempt.amount_in_cents,
          expiresAt: new Date(attempt.expires_at),
          redirectUrl: `${siteConfig.url}/citas/${id}`,
          customerEmail: user.email,
        });
      }
    }
  }

  const status = displayStatus(appointment);
  const declined =
    status === "pending_payment" &&
    (lastPayment?.status === "declined" || lastPayment?.status === "error");

  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Tu cita</h1>

      <p
        role="status"
        data-testid="appointment-status"
        className={cn("mt-4 rounded-md border p-3 text-sm font-medium", STATUS_STYLES[status])}
      >
        {APPOINTMENT_STATUS_LABELS[status]}
        {status === "confirmed" ? ". ¡Te esperamos!" : null}
      </p>

      <section
        aria-labelledby="titulo-detalle"
        className="mt-6 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-detalle" className="text-lg font-semibold">
          Detalle
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Servicio</dt>
            <dd className="font-medium">
              {appointment.service_name} ({formatDuration(appointment.duration_minutes)})
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fecha y hora</dt>
            <dd className="font-medium first-letter:uppercase">
              {formatFullDateTime(appointment.starts_at)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Valor del servicio</dt>
            <dd className="font-medium">{formatCop(appointment.price_cop)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              Anticipo ({Number(appointment.deposit_percent)} %)
            </dt>
            <dd className="font-medium" data-testid="deposit">
              {formatCop(appointment.deposit_cop)}
            </dd>
          </div>
          {appointment.customer_notes ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Tus notas</dt>
              <dd className="break-words">{appointment.customer_notes}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Aceptaste la versión {appointment.rules_version} de la política de citas.
        </p>
      </section>

      {status === "pending_payment" ? (
        <section
          aria-labelledby="titulo-pago"
          className="mt-6 rounded-xl border border-border bg-card p-5"
        >
          <h2 id="titulo-pago" className="text-lg font-semibold">
            Paga tu anticipo
          </h2>
          {declined ? (
            <p role="alert" className="mt-2 text-sm font-medium text-destructive">
              Tu pago anterior no fue aprobado. Puedes intentarlo de nuevo.
            </p>
          ) : null}
          {lastPayment?.status === "pending" && lastPayment.provider_transaction_id ? (
            <p className="mt-2 text-sm">
              Tu pago está en proceso. Esta página se actualiza cuando el banco lo confirme; puedes
              recargarla en unos minutos.
            </p>
          ) : null}
          {appointment.hold_expires_at ? (
            <p className="mt-2 text-sm">
              Tu horario está apartado hasta las{" "}
              <strong>{formatClock(appointment.hold_expires_at)}</strong>. Si no pagas a tiempo, se
              libera para otra persona.
            </p>
          ) : null}

          {checkout ? (
            // Formulario hacia el checkout de Wompi. La firma impide cambiar el monto.
            <form
              method="get"
              action={WOMPI_CHECKOUT_URL}
              className="mt-4"
              data-testid="wompi-form"
            >
              {Object.entries(checkout).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                Pagar {formatCop(appointment.deposit_cop)} con Wompi
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Tarjeta, PSE, Nequi y otros medios. Wompi procesa el pago; nosotros no vemos los
                datos de tu tarjeta.
              </p>
            </form>
          ) : (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              {paymentError}
            </p>
          )}
        </section>
      ) : null}

      {status === "expired" || status === "cancelled" ? (
        <Link href="/agendar" className={buttonVariants({ className: "mt-6" })}>
          Reservar otro horario
        </Link>
      ) : null}

      <p className="mt-6">
        <Link
          href="/cuenta/citas"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
        >
          Ver todas mis citas
        </Link>
      </p>
    </main>
  );
}
