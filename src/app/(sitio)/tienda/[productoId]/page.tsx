import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff } from "lucide-react";
import { z } from "zod";
import { formatCop } from "@/modules/booking/policy";
import { AddToCart } from "@/modules/shop/components/add-to-cart";
import { UNOPTIMIZED_IMAGES } from "@/modules/shop/images";
import { getProduct } from "@/modules/shop/queries";

export async function generateMetadata({
  params,
}: PageProps<"/tienda/[productoId]">): Promise<Metadata> {
  const { productoId } = await params;
  if (!z.uuid().safeParse(productoId).success) return { title: "Producto" };
  const product = await getProduct(productoId);
  return product
    ? { title: product.name, description: product.description?.slice(0, 160) }
    : { title: "Producto" };
}

export default async function ProductPage({ params }: PageProps<"/tienda/[productoId]">) {
  const { productoId } = await params;
  if (!z.uuid().safeParse(productoId).success) notFound();
  const product = await getProduct(productoId);
  if (!product) notFound();
  const [main, ...rest] = product.images;

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Link
        href="/tienda"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
      >
        Volver a la tienda
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="grid gap-3">
          <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
            {main ? (
              <Image
                src={main.url}
                alt={main.alt}
                fill
                priority
                sizes="(min-width: 768px) 480px, 90vw"
                className="object-cover"
                unoptimized={UNOPTIMIZED_IMAGES}
              />
            ) : (
              <ImageOff
                aria-hidden="true"
                className="absolute inset-0 m-auto size-10 text-muted-foreground"
              />
            )}
          </div>
          {rest.length ? (
            <ul className="grid grid-cols-4 gap-2" aria-label="Más fotos">
              {rest.map((image) => (
                <li
                  key={image.url}
                  className="relative aspect-square overflow-hidden rounded-md bg-muted"
                >
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="120px"
                    className="object-cover"
                    unoptimized={UNOPTIMIZED_IMAGES}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          {product.category ? (
            <Link
              href={`/tienda?categoria=${product.category.id}`}
              className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {product.category.name}
            </Link>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <p className="mt-2 text-2xl font-semibold" data-testid="product-price">
            {formatCop(product.priceCop)}
          </p>
          <p className="text-sm text-muted-foreground">IVA incluido</p>
          {product.description ? (
            <p className="mt-4 whitespace-pre-line">{product.description}</p>
          ) : null}
          <div className="mt-6">
            <AddToCart productId={product.id} available={product.available} />
          </div>
        </div>
      </div>
    </main>
  );
}
