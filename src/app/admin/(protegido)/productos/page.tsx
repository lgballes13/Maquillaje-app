import type { Metadata } from "next";
import { FillImage } from "@/components/fill-image";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatCop } from "@/modules/booking/policy";
import { deleteProductImageAction } from "@/modules/shop/admin-actions";
import { CategoryForm } from "@/modules/shop/components/category-form";
import { ImageUploadForm } from "@/modules/shop/components/image-upload-form";
import { ProductForm } from "@/modules/shop/components/product-form";
import { UNOPTIMIZED_IMAGES } from "@/modules/shop/images";
import { getAvailability, productImageUrl } from "@/modules/shop/queries";

export const metadata: Metadata = { title: "Productos" };

export default async function AdminProductsPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: categories }, { data: preorders }, { data: waitlist }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id, name, description, category_id, price_cop, stock, sort_order, is_active, allow_preorder, product_images(id, storage_path, alt_text, sort_order)",
        )
        .order("is_active", { ascending: false })
        .order("sort_order")
        .order("name"),
      supabase
        .from("product_categories")
        .select("id, name, sort_order, is_active")
        .order("sort_order")
        .order("name"),
      // Preventas con anticipo esperando que llegue el producto.
      supabase
        .from("orders")
        .select("order_items(product_id, quantity)")
        .eq("kind", "preorder")
        .eq("status", "deposit_paid")
        .limit(1000),
      supabase.from("product_waitlist").select("product_id").is("notified_at", null).limit(5000),
    ]);
  const availability = await getAvailability(
    (products ?? []).filter((p) => p.is_active).map((p) => p.id),
  );
  const categoryNames = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const reservedUnits = new Map<string, number>();
  for (const item of (preorders ?? []).flatMap((order) => order.order_items)) {
    reservedUnits.set(item.product_id, (reservedUnits.get(item.product_id) ?? 0) + item.quantity);
  }
  const waiting = new Map<string, number>();
  for (const row of waitlist ?? []) {
    waiting.set(row.product_id, (waiting.get(row.product_id) ?? 0) + 1);
  }

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
      <p className="mt-2 text-muted-foreground">
        Los productos no se borran (los pedidos los usan): desmarca «Visible en la tienda» para
        ocultarlos. Cambiar un precio no afecta los pedidos ya hechos.
      </p>

      <section
        aria-labelledby="titulo-nuevo"
        className="mt-8 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-nuevo" className="mb-4 text-lg font-semibold">
          Nuevo producto
        </h2>
        <ProductForm categories={categories ?? []} />
      </section>

      <section aria-labelledby="titulo-lista" className="mt-8">
        <h2 id="titulo-lista" className="text-lg font-semibold">
          Productos existentes
        </h2>
        <ul className="mt-3 grid gap-3">
          {products?.map((product) => {
            const images = [...product.product_images].sort((a, b) => a.sort_order - b.sort_order);
            const available = availability.get(product.id);
            return (
              <li key={product.id} className="rounded-xl border border-border bg-card">
                <details>
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 px-5 py-3">
                    <span className="font-semibold">{product.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatCop(product.price_cop)} · {product.stock} en el estudio
                      {available !== undefined && available < product.stock
                        ? ` (${product.stock - available} apartadas)`
                        : ""}
                      {product.category_id
                        ? ` · ${categoryNames.get(product.category_id) ?? ""}`
                        : ""}
                      {product.is_active ? "" : " · Oculto"}
                      {reservedUnits.get(product.id)
                        ? ` · ${reservedUnits.get(product.id)} en preventa`
                        : ""}
                      {waiting.get(product.id)
                        ? ` · ${waiting.get(product.id)} en lista de espera`
                        : ""}
                      {images.length === 0 ? " · Sin fotos" : ""}
                    </span>
                  </summary>
                  <div className="grid gap-6 border-t border-border p-5">
                    <ProductForm product={product} categories={categories ?? []} />
                    <div>
                      <h3 className="font-semibold">Fotos</h3>
                      {images.length ? (
                        <ul
                          className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
                          aria-label={`Fotos de ${product.name}`}
                        >
                          {images.map((image) => (
                            <li key={image.id} className="grid gap-2">
                              <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                                <FillImage
                                  src={productImageUrl(image.storage_path)}
                                  alt={image.alt_text}
                                  sizes="200px"
                                  className="object-cover"
                                  unoptimized={UNOPTIMIZED_IMAGES}
                                />
                              </div>
                              <form action={deleteProductImageAction}>
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
                      <div className="mt-4">
                        <ImageUploadForm productId={product.id} productName={product.name} />
                      </div>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="titulo-categorias"
        className="mt-8 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-categorias" className="text-lg font-semibold">
          Categorías
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
                  <CategoryForm category={category} />
                </div>
              </details>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 mb-3 font-semibold">Nueva categoría</h3>
        <CategoryForm />
      </section>
    </main>
  );
}
