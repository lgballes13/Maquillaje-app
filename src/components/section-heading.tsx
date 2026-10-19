import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

/** Encabezado de sección: antetítulo dorado, título serif y una línea de contexto. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn(align === "center" && "mx-auto text-center", "max-w-2xl", className)}>
      <p
        className={cn(
          "flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-gold-foreground uppercase",
          align === "center" && "justify-center",
        )}
      >
        <span aria-hidden="true" className="h-px w-8 bg-gold" />
        {eyebrow}
        {align === "center" ? <span aria-hidden="true" className="h-px w-8 bg-gold" /> : null}
      </p>
      <h2 id={id} className="mt-4 text-4xl leading-tight text-plum sm:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}
