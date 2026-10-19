"use client";

import { useState } from "react";
import Link from "next/link";
import { FillImage } from "@/components/fill-image";
import { cn } from "@/lib/utils";

export interface GalleryWork {
  id: string;
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  image: { url: string; alt: string };
}

interface HomeGalleryProps {
  categories: { id: string; name: string }[];
  works: GalleryWork[];
  /** En local las fotos vienen de http://127.0.0.1 y no pasan por el optimizador. */
  unoptimized: boolean;
}

/** Cuántos trabajos se muestran por filtro; el resto está en /portafolio. */
const VISIBLE = 6;

/** Galería del inicio: los filtros cambian los trabajos sin recargar la página. */
export function HomeGallery({ categories, works, unoptimized }: HomeGalleryProps) {
  const [active, setActive] = useState<string | null>(null);
  // El aviso para lectores de pantalla solo se escribe después de usar un filtro.
  const [filtered, setFiltered] = useState(false);
  const matching = active ? works.filter((work) => work.categoryId === active) : works;
  const shown = matching.slice(0, VISIBLE);
  const activeName = categories.find((category) => category.id === active)?.name;

  return (
    <div className="mt-10">
      <div
        role="group"
        aria-label="Filtrar trabajos por categoría"
        className="flex flex-wrap justify-center gap-2"
      >
        {[{ id: null, name: "Todos" }, ...categories].map((category) => (
          <button
            key={category.id ?? "todos"}
            type="button"
            aria-pressed={active === category.id}
            onClick={() => {
              setActive(category.id);
              setFiltered(true);
            }}
            className="inline-flex min-h-11 items-center rounded-full border border-gold/50 bg-card px-5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {category.name}
          </button>
        ))}
      </div>

      <p role="status" className="sr-only">
        {filtered
          ? `${shown.length === 1 ? "1 trabajo" : `${shown.length} trabajos`}${activeName ? ` de ${activeName}` : ""}`
          : ""}
      </p>

      {shown.length ? (
        <ul
          aria-label="Trabajos destacados"
          className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3"
        >
          {shown.map((work, index) => (
            <li key={work.id} className={cn(index === 0 && "col-span-2 lg:col-span-1")}>
              <Link
                href={`/portafolio/${work.id}`}
                className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-secondary shadow-md shadow-plum/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <FillImage
                  src={work.image.url}
                  alt={work.image.alt}
                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 50vw"
                  unoptimized={unoptimized}
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                />
                <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-plum/90 via-plum/60 to-transparent px-4 pt-12 pb-4 text-plum-foreground">
                  {work.categoryName ? (
                    <span className="block text-xs font-semibold tracking-[0.2em] text-gold uppercase">
                      {work.categoryName}
                    </span>
                  ) : null}
                  <span className="mt-1 block font-serif text-xl leading-tight sm:text-2xl">
                    {work.title}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p
          data-testid="gallery-empty-category"
          className="mx-auto mt-8 max-w-md rounded-2xl border border-gold/40 bg-card px-6 py-8 text-center text-muted-foreground"
        >
          Todavía no hay trabajos de {activeName ?? "esta categoría"} publicados. Mira las demás
          categorías o el portafolio completo.
        </p>
      )}
    </div>
  );
}
