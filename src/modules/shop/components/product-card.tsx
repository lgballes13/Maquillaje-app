import { FillImage } from "@/components/fill-image";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { formatCop } from "@/modules/booking/policy";
import { UNOPTIMIZED_IMAGES } from "../images";
import type { CatalogProduct } from "../queries";

export function ProductCard({
  product,
  priority,
}: {
  product: CatalogProduct;
  priority?: boolean;
}) {
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <Link
        href={`/tienda/${product.id}`}
        className="flex h-full flex-col hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="relative aspect-square bg-muted">
          {product.image ? (
            <FillImage
              src={product.image.url}
              alt={product.image.alt}
              sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 90vw"
              className="object-cover"
              priority={priority}
              unoptimized={UNOPTIMIZED_IMAGES}
            />
          ) : (
            <ImageOff
              aria-hidden="true"
              className="absolute inset-0 m-auto size-8 text-muted-foreground"
            />
          )}
        </div>
        <div className="grid gap-1 p-4">
          {product.categoryName ? (
            <span className="text-xs text-muted-foreground">{product.categoryName}</span>
          ) : null}
          <h2 className="font-semibold">{product.name}</h2>
          <span className="text-lg font-semibold">{formatCop(product.priceCop)}</span>
          {product.available === 0 ? (
            <span className="text-sm text-muted-foreground">
              {product.allowPreorder ? "Agotado: puedes reservarlo" : "Agotado"}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
