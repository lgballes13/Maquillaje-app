import { getImageProps, type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

type FillImageProps = Omit<ImageProps, "fill" | "width" | "height" | "style">;

/**
 * Igual que `<Image fill>` de Next.js, pero sin atributo `style`: la CSP no
 * permite estilos en línea (DT-004) y el navegador los descartaba, así que la
 * foto perdía su posición. La misma posición se da con clases de Tailwind.
 * El contenedor debe tener `relative` y un tamaño (por ejemplo, `aspect-square`).
 */
export function FillImage({ className, ...props }: FillImageProps) {
  const {
    props: { style: _style, alt, ...imgProps },
  } = getImageProps({ ...props, fill: true });
  return (
    // eslint-disable-next-line @next/next/no-img-element -- son las props de next/image (srcset, sizes, lazy)
    <img
      {...imgProps}
      alt={alt}
      className={cn("absolute inset-0 size-full text-transparent", className)}
    />
  );
}
