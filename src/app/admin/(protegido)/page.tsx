import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CalendarDays,
  Download,
  ImagePlus,
  PackagePlus,
  ShoppingBag,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { formatClock, formatDateTime, formatLongDate, formatShortDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { addDays, toZonedDateString } from "@/lib/time";
import { cn } from "@/lib/utils";
import { getAgenda, getReport } from "@/modules/admin/queries";
import { totalIncome } from "@/modules/admin/reports";
import { requireAdmin } from "@/modules/auth/session";
import { APPOINTMENT_STATUS_LABELS, formatCop } from "@/modules/booking/policy";
import { ORDER_STATUS_LABELS } from "@/modules/shop/labels";

export const metadata: Metadata = { title: "Resumen" };

/** Desde cuántas unidades un producto se marca con poco stock. */
const LOW_STOCK = 3;
/** Días que cubre la lista de próximas citas (hoy incluido). */
const UPCOMING_DAYS = 7;

const QUICK_ACTIONS = [
  { href: "/admin/citas#titulo-bloqueos", label: "Bloquear horario", icon: Ban },
  { href: "/admin/productos#titulo-nuevo", label: "Nuevo producto", icon: PackagePlus },
  { href: "/admin/portafolio#titulo-nuevo-trabajo", label: "Nuevo trabajo", icon: ImagePlus },
  { href: "/admin/reportes", label: "Exportar a CSV", icon: Download },
] as const;

const cardClass = "rounded-[1.5rem] border border-gold/30 bg-card p-5 shadow-sm shadow-plum/5";

function stockState(stock: number) {
  if (stock === 0) return { label: "Agotado", className: "bg-primary/10 text-primary" };
  if (stock <= LOW_STOCK) return { label: "Poco stock", className: "bg-gold/25 text-plum" };
  return { label: "Disponible", className: "bg-muted text-muted-foreground" };
}

type Activity = { at: string; title: string; detail: string; href: string };

export default async function AdminDashboardPage() {
  // El layout también lo revisa, pero corre en paralelo con la página.
  await requireAdmin("/admin");
  const today = toZonedDateString(new Date(), siteConfig.timeZone);
  const days = Array.from({ length: UPCOMING_DAYS }, (_, i) => addDays(today, i));
  const supabase = await createClient();

  const [agenda, report, pendingOrders, { data: products }, recentAppointments, recentOrders] =
    await Promise.all([
      getAgenda(days),
      getReport(`${today.slice(0, 8)}01`, today),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["paid", "ready", "shipped"]),
      supabase
        .from("products")
        .select("id, name, stock, allow_preorder")
        .eq("is_active", true)
        .order("stock")
        .order("name")
        .limit(200),
      supabase
        .from("appointments")
        .select("id, service_name, status, starts_at, created_at, cancelled_at")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("orders")
        .select("id, number, status, total_cop, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const upcoming = agenda.days.flatMap((day) =>
    day.entries.flatMap((entry) =>
      entry.kind === "appointment" ? [{ date: day.date, entry }] : [],
    ),
  );
  const todayCount = upcoming.filter((item) => item.date === today).length;
  const lowStock = (products ?? []).filter((p) => p.stock <= LOW_STOCK);

  const activity: Activity[] = [
    ...(recentAppointments.data ?? []).map((a) => ({
      at: a.cancelled_at ?? a.created_at,
      title: a.cancelled_at ? "Cita cancelada" : "Nueva cita",
      detail: `${a.service_name} · ${formatDateTime(a.starts_at)} · ${APPOINTMENT_STATUS_LABELS[a.status]}`,
      href: "/admin/citas",
    })),
    ...(recentOrders.data ?? []).map((o) => ({
      at: o.created_at,
      title: `Pedido #${o.number}`,
      detail: `${formatCop(o.total_cop)} · ${ORDER_STATUS_LABELS[o.status]}`,
      href: "/admin/pedidos",
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  const metrics = [
    {
      label: "Citas hoy",
      value: String(todayCount),
      hint: formatLongDate(today),
      href: "/admin/agenda",
      icon: CalendarDays,
    },
    {
      label: "Ingresos del mes",
      value: formatCop(totalIncome(report)),
      hint: "Anticipos, tienda y preventas pagadas",
      href: "/admin/reportes",
      icon: Wallet,
    },
    {
      label: "Pedidos por entregar",
      value: String(pendingOrders.count ?? 0),
      hint: "Pagados, listos o enviados",
      href: "/admin/pedidos",
      icon: ShoppingBag,
    },
    {
      label: "Stock bajo",
      value: String(lowStock.length),
      hint: `${LOW_STOCK} unidades o menos`,
      href: "/admin/productos#titulo-lista",
      icon: TriangleAlert,
    },
  ];

  return (
    <main id="contenido" className="w-full flex-1 px-4 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-gold-foreground uppercase">
            Panel de administración
          </p>
          <h1 className="mt-2 text-4xl text-plum">Resumen</h1>
        </div>
        <p className="text-sm text-muted-foreground">{formatLongDate(today)}</p>
      </div>

      <section aria-labelledby="titulo-metricas" className="mt-8">
        <h2 id="titulo-metricas" className="sr-only">
          Métricas
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ label, value, hint, href, icon: Icon }) => (
            <li key={label}>
              <Link
                href={href}
                className={cn(
                  cardClass,
                  "flex h-full flex-col gap-2 transition-colors hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                )}
              >
                <span className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                  {label}
                  <Icon aria-hidden="true" className="size-5 text-gold-foreground" />
                </span>
                <span className="font-serif text-4xl text-plum">{value}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-acciones" className="mt-8">
        <h2 id="titulo-acciones" className="text-xl text-plum">
          Acciones rápidas
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/50 bg-card px-4 text-sm font-medium text-plum transition-colors hover:border-primary hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section aria-labelledby="titulo-proximas" className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="titulo-proximas" className="text-xl text-plum">
              Próximas citas
            </h2>
            <Link
              href="/admin/agenda?vista=semana"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver la semana
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          {upcoming.length ? (
            <ol className="mt-3 divide-y divide-border">
              {upcoming.slice(0, 6).map(({ date, entry }) => {
                if (entry.kind !== "appointment") return null;
                const customer = agenda.profiles.get(entry.appointment.customerId);
                return (
                  <li key={entry.appointment.id} className="flex gap-4 py-3">
                    <span className="w-20 shrink-0 text-sm">
                      <span className="block font-semibold text-plum">
                        {formatClock(entry.appointment.startsAt)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {date === today ? "Hoy" : formatShortDate(date)}
                      </span>
                    </span>
                    <span className="min-w-0 text-sm">
                      <span className="block font-medium">{entry.appointment.serviceName}</span>
                      <span className="text-muted-foreground">
                        {customer?.full_name ?? "Clienta"} ·{" "}
                        {APPOINTMENT_STATUS_LABELS[
                          entry.appointment.status as keyof typeof APPOINTMENT_STATUS_LABELS
                        ] ?? entry.appointment.status}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-3 rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              No hay citas en los próximos {UPCOMING_DAYS} días.
            </p>
          )}
        </section>

        <section aria-labelledby="titulo-actividad" className={cardClass}>
          <h2 id="titulo-actividad" className="text-xl text-plum">
            Actividad reciente
          </h2>
          {activity.length ? (
            <ol className="mt-3 grid gap-1">
              {activity.map((item) => (
                <li key={`${item.title}-${item.at}`}>
                  <Link
                    href={item.href}
                    className="flex gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-1.5 shrink-0 rotate-45 bg-gold"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{item.title}</span>
                      <span className="block text-muted-foreground">{item.detail}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(item.at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              Todavía no hay citas ni pedidos.
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="titulo-stock" className={cn(cardClass, "mt-6")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="titulo-stock" className="text-xl text-plum">
            Stock de la tienda
          </h2>
          <Link
            href="/admin/productos#titulo-lista"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Editar el catálogo
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        {products?.length ? (
          <div className="mt-3">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Productos visibles en la tienda, de menos a más unidades
              </caption>
              <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Producto
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">
                    Unidades
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.slice(0, 8).map((product) => {
                  const state = stockState(product.stock);
                  return (
                    <tr key={product.id}>
                      <th scope="row" className="py-3 pr-4 font-medium">
                        {product.name}
                      </th>
                      <td className="py-3 pr-4 text-right tabular-nums">{product.stock}</td>
                      <td className="py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                            state.className,
                          )}
                        >
                          {state.label}
                          {product.stock === 0 && product.allow_preorder ? " · en preventa" : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            Todavía no hay productos visibles en la tienda.
          </p>
        )}
      </section>
    </main>
  );
}
