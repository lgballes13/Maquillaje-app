import { FillImage } from "@/components/fill-image";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { UNOPTIMIZED_IMAGES } from "@/modules/shop/images";
import type { PortfolioCard } from "../queries";

export function WorkCard({ work, priority }: { work: PortfolioCard; priority?: boolean }) {
  const cover = work.after ?? work.before;
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <Link
        href={`/portafolio/${work.id}`}
        className="flex h-full flex-col hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="relative aspect-[4/5] bg-muted">
          {cover ? (
            <FillImage
              src={cover.url}
              alt={cover.alt}
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
          {work.categoryName ? (
            <span className="text-xs text-muted-foreground">{work.categoryName}</span>
          ) : null}
          <h2 className="font-semibold">{work.title}</h2>
          {work.before ? (
            <span className="text-sm text-muted-foreground">Con foto de antes y después</span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
