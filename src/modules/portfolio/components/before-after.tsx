"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { UNOPTIMIZED_IMAGES } from "@/modules/shop/images";
import { IMAGE_KIND_LABELS, type PortfolioImageKind } from "../labels";
import type { PortfolioImage } from "../queries";

/**
 * Comparación antes / después. En celular se cambia con dos botones (se usan
 * con el teclado y el lector de pantalla anuncia cuál está activo); en
 * pantallas anchas se ven las dos lado a lado.
 */
export function BeforeAfter({
  before,
  after,
}: {
  before: PortfolioImage | null;
  after: PortfolioImage;
}) {
  const [showing, setShowing] = useState<PortfolioImageKind>("after");
  const images = before ? [before, after] : [after];

  return (
    <div className="grid gap-3">
      {before ? (
        <div role="group" aria-label="Ver foto" className="flex gap-2 sm:hidden">
          {(["before", "after"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={showing === kind}
              onClick={() => setShowing(kind)}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center rounded-md border px-4 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                showing === kind
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              {IMAGE_KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      ) : null}
      <div className={cn("grid gap-3", before && "sm:grid-cols-2")}>
        {images.map((image, i) => (
          <figure
            key={image.url}
            className={cn("grid gap-1", before && image.kind !== showing && "hidden sm:grid")}
            data-testid={`photo-${image.kind}`}
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
              <Image
                src={image.url}
                alt={image.alt}
                fill
                priority={i === images.length - 1}
                sizes="(min-width: 640px) 480px, 90vw"
                className="object-cover"
                unoptimized={UNOPTIMIZED_IMAGES}
              />
            </div>
            <figcaption className="text-sm font-medium text-muted-foreground">
              {IMAGE_KIND_LABELS[image.kind]}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
