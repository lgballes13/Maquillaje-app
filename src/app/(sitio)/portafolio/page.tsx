import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { WorkCard } from "@/modules/portfolio/components/work-card";
import { getPortfolioCategories, getPublishedWorks } from "@/modules/portfolio/queries";

export const metadata: Metadata = {
  title: "Portafolio",
  description: "Trabajos de maquillaje de novia, social y editorial, con fotos de antes y después.",
};

const chipClass =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

export default async function PortfolioPage({ searchParams }: PageProps<"/portafolio">) {
  const params = await searchParams;
  const categories = await getPortfolioCategories();
  const requested = z.uuid().safeParse(params.categoria);
  const category = requested.success
    ? (categories.find((c) => c.id === requested.data) ?? null)
    : null;
  const works = await getPublishedWorks(category?.id ?? null);

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Portafolio</h1>
      <p className="mt-2 text-muted-foreground">
        Algunos de nuestros trabajos. Todas las fotos se publican con autorización de cada clienta.
      </p>

      {categories.length ? (
        <nav aria-label="Categorías del portafolio" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {[{ id: null, name: "Todo" }, ...categories].map((c) => {
              const active = (category?.id ?? null) === c.id;
              return (
                <li key={c.id ?? "todo"}>
                  <Link
                    href={c.id ? `/portafolio?categoria=${c.id}` : "/portafolio"}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      chipClass,
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-accent",
                    )}
                  >
                    {c.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <p role="status" className="sr-only">
        {works.length === 1 ? "1 trabajo" : `${works.length} trabajos`}
      </p>
      {works.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <p data-testid="no-works">
            {category
              ? "Todavía no hay trabajos en esta categoría."
              : "Pronto publicaremos nuestros trabajos."}
          </p>
          {category ? (
            <Link
              href="/portafolio"
              className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
            >
              Ver todos los trabajos
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Trabajos">
          {works.map((work, i) => (
            <WorkCard key={work.id} work={work} priority={i < 2} />
          ))}
        </ul>
      )}
    </main>
  );
}
