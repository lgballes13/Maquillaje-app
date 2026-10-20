import Link from "next/link";
import { FillImage } from "@/components/fill-image";
import { cn } from "@/lib/utils";

export interface GalleryWork {
  id: string;
  title: string;
  categoryName: string | null;
  image: { url: string; alt: string };
}

interface HomeGalleryProps {
  categories: { id: string; name: string }[];
  /** Categoría elegida en el filtro (null = todas). */
  active: { id: string; name: string } | null;
  works: GalleryWork[];
  /** En local las fotos vienen de http://127.0.0.1 y no pasan por el optimizador. */
  unoptimized: boolean;
}

/**
 * Galería del inicio. Los filtros son enlaces (?galeria=<categoría>): Next.js cambia los
 * trabajos sin recargar la página ni mover el scroll, y no suma JavaScript al inicio, que
 * tiene que cargar rápido en celulares lentos.
 */
export function HomeGallery({ categories, active, works, unoptimized }: HomeGalleryProps) {
  return (
    <div className="mt-10">
      <nav aria-label="Filtrar trabajos por categoría">
        <ul className="flex flex-wrap justify-center gap-2">
          {[{ id: null, name: "Todos" }, ...categories].map((category) => {
            const current = (active?.id ?? null) === category.id;
            return (
              <li key={category.id ?? "todos"}>
                <Link
                  href={category.id ? `/?galeria=${category.id}` : "/"}
                  scroll={false}
                  aria-current={current ? "true" : undefined}
                  className="inline-flex min-h-11 items-center rounded-full border border-gold/50 bg-card px-5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=true]:border-primary aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground"
                >
                  {category.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p role="status" className="sr-only">
        {active
          ? `${works.length === 1 ? "1 trabajo" : `${works.length} trabajos`} de ${active.name}`
          : ""}
      </p>

      {works.length ? (
        <ul
          aria-label="Trabajos destacados"
          className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3"
        >
          {works.map((work, index) => (
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
          Todavía no hay trabajos de {active?.name ?? "esta categoría"} publicados. Mira las demás
          categorías o el portafolio completo.
        </p>
      )}
    </div>
  );
}
