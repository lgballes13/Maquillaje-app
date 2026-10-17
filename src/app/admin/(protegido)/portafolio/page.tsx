import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatLongDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { deleteWorkImageAction } from "@/modules/portfolio/admin-actions";
import { PortfolioCategoryForm } from "@/modules/portfolio/components/category-form";
import { ConsentForm } from "@/modules/portfolio/components/consent-form";
import { PublishForm } from "@/modules/portfolio/components/publish-form";
import { RevokeConsentForm } from "@/modules/portfolio/components/revoke-consent-form";
import { WorkForm } from "@/modules/portfolio/components/work-form";
import { WorkImageForm } from "@/modules/portfolio/components/work-image-form";
import { IMAGE_KIND_LABELS } from "@/modules/portfolio/labels";
import { portfolioImageUrl } from "@/modules/portfolio/queries";
import { todayInBogota } from "@/modules/portfolio/schemas";
import { UNOPTIMIZED_IMAGES } from "@/modules/shop/images";

export const metadata: Metadata = { title: "Portafolio" };

export default async function AdminPortfolioPage() {
  const supabase = await createClient();
  const [{ data: consents }, { data: works }, { data: categories }, { data: services }] =
    await Promise.all([
      supabase
        .from("portfolio_consents")
        .select("id, client_name, signed_on, notes, revoked_at, revoked_reason, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("portfolio_works")
        .select(
          "id, title, description, category_id, service_id, consent_id, sort_order, is_published, portfolio_images(id, kind, storage_path, alt_text, sort_order)",
        )
        .order("is_published", { ascending: false })
        .order("sort_order")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("portfolio_categories")
        .select("id, name, sort_order, is_active")
        .order("sort_order")
        .order("name"),
      supabase.from("services").select("id, name").eq("is_active", true).order("sort_order"),
    ]);

  const consentById = new Map((consents ?? []).map((c) => [c.id, c]));
  const activeConsents = (consents ?? [])
    .filter((c) => c.revoked_at === null)
    .map((c) => ({ id: c.id, name: `${c.client_name} · firmó el ${formatLongDate(c.signed_on)}` }));
  const worksByConsent = new Map<string, number>();
  for (const work of works ?? []) {
    worksByConsent.set(work.consent_id, (worksByConsent.get(work.consent_id) ?? 0) + 1);
  }
  const activeCategories = (categories ?? []).filter((c) => c.is_active);

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Portafolio</h1>
      <p className="mt-2 text-muted-foreground">
        Solo se publican fotos con la autorización firmada de la clienta (Ley 1581). Primero
        registra la autorización, luego crea el trabajo, súbele fotos y publícalo.
      </p>

      <section
        aria-labelledby="titulo-autorizaciones"
        className="mt-8 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-autorizaciones" className="text-lg font-semibold">
          Autorizaciones firmadas
        </h2>
        <div className="mt-4">
          <ConsentForm today={todayInBogota()} />
        </div>
        {consents?.length ? (
          <ul className="mt-6 grid gap-3" aria-label="Autorizaciones registradas">
            {consents.map((consent) => (
              <li key={consent.id} className="rounded-md border border-border">
                <details>
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 px-4 py-2">
                    <span className="font-medium">{consent.client_name}</span>
                    <span className="text-sm text-muted-foreground">
                      · firmó el {formatLongDate(consent.signed_on)} ·{" "}
                      {consent.revoked_at ? "Retirada" : "Vigente"} ·{" "}
                      {worksByConsent.get(consent.id) ?? 0} trabajos
                    </span>
                  </summary>
                  <div className="grid gap-4 border-t border-border p-4 text-sm">
                    <Link
                      href={`/admin/portafolio/autorizaciones/${consent.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
                    >
                      Ver el formato firmado
                      <span className="sr-only">
                        {" "}
                        de {consent.client_name} (se abre en otra pestaña)
                      </span>
                    </Link>
                    {consent.notes ? <p className="break-words">Notas: {consent.notes}</p> : null}
                    {consent.revoked_at ? (
                      <p data-testid="consent-revoked">
                        Retirada el {formatDateTime(consent.revoked_at)}
                        {consent.revoked_reason ? `: ${consent.revoked_reason}` : "."}
                      </p>
                    ) : (
                      <div>
                        <h3 className="mb-2 font-semibold">¿La clienta retiró la autorización?</h3>
                        <RevokeConsentForm
                          consentId={consent.id}
                          clientName={consent.client_name}
                        />
                      </div>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        aria-labelledby="titulo-nuevo-trabajo"
        className="mt-8 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-nuevo-trabajo" className="mb-4 text-lg font-semibold">
          Nuevo trabajo
        </h2>
        {activeConsents.length ? (
          <WorkForm
            categories={activeCategories}
            services={services ?? []}
            consents={activeConsents}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Primero registra una autorización firmada (arriba).
          </p>
        )}
      </section>

      <section aria-labelledby="titulo-trabajos" className="mt-8">
        <h2 id="titulo-trabajos" className="text-lg font-semibold">
          Trabajos
        </h2>
        {works?.length ? (
          <ul className="mt-3 grid gap-3">
            {works.map((work) => {
              const consent = consentById.get(work.consent_id);
              const revoked = Boolean(consent?.revoked_at);
              const images = [...work.portfolio_images].sort((a, b) => a.sort_order - b.sort_order);
              return (
                <li key={work.id} className="rounded-xl border border-border bg-card">
                  <details>
                    <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 px-5 py-3">
                      <span className="font-semibold">{work.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {work.is_published ? "Publicado" : "Oculto"} · {consent?.client_name}
                        {revoked ? " · Autorización retirada" : ""} · {images.length} fotos
                      </span>
                    </summary>
                    <div className="grid gap-6 border-t border-border p-5">
                      {revoked ? (
                        <p className="text-sm font-medium text-destructive">
                          La clienta retiró la autorización: este trabajo no se puede publicar.
                        </p>
                      ) : (
                        <PublishForm workId={work.id} published={work.is_published} />
                      )}
                      {work.is_published ? (
                        <Link
                          href={`/portafolio/${work.id}`}
                          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
                        >
                          Ver en el portafolio
                        </Link>
                      ) : null}
                      <WorkForm
                        work={work}
                        categories={categories ?? []}
                        services={services ?? []}
                      />
                      <div>
                        <h3 className="font-semibold">Fotos</h3>
                        {images.length ? (
                          <ul
                            className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
                            aria-label={`Fotos de ${work.title}`}
                          >
                            {images.map((image) => (
                              <li key={image.id} className="grid gap-2">
                                <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
                                  <Image
                                    src={portfolioImageUrl(image.storage_path)}
                                    alt={image.alt_text}
                                    fill
                                    sizes="200px"
                                    className="object-cover"
                                    unoptimized={UNOPTIMIZED_IMAGES}
                                  />
                                </div>
                                <span className="text-sm">{IMAGE_KIND_LABELS[image.kind]}</span>
                                <form action={deleteWorkImageAction}>
                                  <input type="hidden" name="id" value={image.id} />
                                  <Button
                                    type="submit"
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                  >
                                    Quitar foto<span className="sr-only">: {image.alt_text}</span>
                                  </Button>
                                </form>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Todavía no tiene fotos.
                          </p>
                        )}
                        {revoked ? null : (
                          <div className="mt-4">
                            <WorkImageForm workId={work.id} />
                          </div>
                        )}
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-muted-foreground">Todavía no hay trabajos.</p>
        )}
      </section>

      <section
        aria-labelledby="titulo-categorias"
        className="mt-8 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-categorias" className="text-lg font-semibold">
          Categorías del portafolio
        </h2>
        <ul className="mt-3 grid gap-3">
          {categories?.map((category) => (
            <li key={category.id} className="rounded-md border border-border">
              <details>
                <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2">
                  <span className="font-medium">{category.name}</span>
                  {category.is_active ? null : (
                    <span className="text-sm text-muted-foreground">· Oculta</span>
                  )}
                </summary>
                <div className="border-t border-border p-4">
                  <PortfolioCategoryForm category={category} />
                </div>
              </details>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 mb-3 font-semibold">Nueva categoría</h3>
        <PortfolioCategoryForm />
      </section>
    </main>
  );
}
