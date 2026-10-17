import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/modules/shop/components/product-card";
import { getActiveCategories, getCatalog } from "@/modules/shop/queries";
import { cleanSearch } from "@/modules/shop/schemas";

export const metadata: Metadata = {
  title: "Tienda",
  description:
    "Productos de maquillaje que usamos en el estudio. Recoge en el estudio o recibe en casa.",
};

const chipClass =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

export default async function ShopPage({ searchParams }: PageProps<"/tienda">) {
  const params = await searchParams;
  const search = cleanSearch(params.q);
  const categories = await getActiveCategories();
  const requested = z.uuid().safeParse(params.categoria);
  const category = requested.success
    ? (categories.find((c) => c.id === requested.data) ?? null)
    : null;
  const products = await getCatalog({ search, categoryId: category?.id ?? null });

  const hrefFor = (categoryId: string | null) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (categoryId) query.set("categoria", categoryId);
    const qs = query.toString();
    return qs ? `/tienda?${qs}` : "/tienda";
  };

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Tienda</h1>
      <p className="mt-2 text-muted-foreground">
        Precios con IVA incluido. Recoge en el estudio o recibe en casa.
      </p>

      <form role="search" action="/tienda" className="mt-6 flex items-end gap-2">
        {category ? <input type="hidden" name="categoria" value={category.id} /> : null}
        <div className="grid flex-1 gap-2">
          <Label htmlFor="buscar">Buscar productos</Label>
          <Input
            id="buscar"
            name="q"
            type="search"
            maxLength={60}
            defaultValue={search}
            placeholder="Ej.: labial"
          />
        </div>
        <Button type="submit" size="icon" aria-label="Buscar">
          <Search aria-hidden="true" />
        </Button>
      </form>

      {categories.length ? (
        <nav aria-label="Categorías" className="mt-4">
          <ul className="flex flex-wrap gap-2">
            {[{ id: null, name: "Todo" }, ...categories].map((c) => {
              const active = (category?.id ?? null) === c.id;
              return (
                <li key={c.id ?? "todo"}>
                  <Link
                    href={hrefFor(c.id)}
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
        {products.length === 1 ? "1 producto" : `${products.length} productos`}
      </p>
      {products.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <p data-testid="no-results">
            {search || category
              ? "No encontramos productos con esa búsqueda."
              : "Pronto tendremos productos en la tienda."}
          </p>
          {search || category ? (
            <Link
              href="/tienda"
              className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
            >
              Ver todos los productos
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Productos">
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} priority={i < 2} />
          ))}
        </ul>
      )}
    </main>
  );
}
