import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

// Diseño común de las páginas públicas y de la cuenta del cliente.
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
