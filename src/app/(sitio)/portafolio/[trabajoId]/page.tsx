import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { buttonVariants } from "@/components/ui/button";
import { BeforeAfter } from "@/modules/portfolio/components/before-after";
import { getPublishedWork } from "@/modules/portfolio/queries";
import { UNOPTIMIZED_IMAGES } from "@/modules/shop/images";

export async function generateMetadata({
  params,
}: PageProps<"/portafolio/[trabajoId]">): Promise<Metadata> {
  const { trabajoId } = await params;
  if (!z.uuid().safeParse(trabajoId).success) return { title: "Portafolio" };
  const work = await getPublishedWork(trabajoId);
  return work
    ? { title: work.title, description: work.description?.slice(0, 160) }
    : { title: "Portafolio" };
}

export default async function WorkPage({ params }: PageProps<"/portafolio/[trabajoId]">) {
  const { trabajoId } = await params;
  if (!z.uuid().safeParse(trabajoId).success) notFound();
  const work = await getPublishedWork(trabajoId);
  if (!work?.after) notFound();

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Link
        href="/portafolio"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
      >
        Volver al portafolio
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-[3fr_2fr]">
        <BeforeAfter before={work.before} after={work.after} />
        <div>
          {work.category ? (
            <Link
              href={`/portafolio?categoria=${work.category.id}`}
              className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {work.category.name}
            </Link>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight">{work.title}</h1>
          {work.description ? <p className="mt-4 whitespace-pre-line">{work.description}</p> : null}
          {work.service ? (
            <div className="mt-6">
              <Link
                href={`/agendar/${work.service.id}`}
                className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}
              >
                Agendar este estilo
              </Link>
              <p className="mt-2 text-sm text-muted-foreground">Servicio: {work.service.name}</p>
            </div>
          ) : null}
        </div>
      </div>
      {work.others.length ? (
        <section aria-labelledby="titulo-mas-fotos" className="mt-8">
          <h2 id="titulo-mas-fotos" className="text-lg font-semibold">
            Más fotos
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {work.others.map((image) => (
              <li
                key={image.url}
                className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted"
              >
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  sizes="(min-width: 640px) 240px, 45vw"
                  className="object-cover"
                  unoptimized={UNOPTIMIZED_IMAGES}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
