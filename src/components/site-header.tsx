import Link from "next/link";
import { UserRound } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getCurrentUser, isAdminUser } from "@/modules/auth/session";
import { CartLink } from "@/modules/shop/components/cart-link";
import { DesktopNav, MobileNav, type NavItem } from "./site-nav";

const iconLinkClass =
  "relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const isAdmin = user ? await isAdminUser() : false;

  const items: NavItem[] = [
    { href: "/agendar", label: "Agendar" },
    { href: "/tienda", label: "Tienda" },
    { href: "/portafolio", label: "Portafolio" },
    ...(isAdmin ? [{ href: "/admin", label: "Panel" }] : []),
  ];
  const account = user
    ? { href: "/cuenta", label: "Mi cuenta" }
    : { href: "/ingresar", label: "Ingresar" };

  return (
    <header className="sticky top-0 z-40 border-b border-gold/30 bg-background/95 backdrop-blur-md">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 md:h-20">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md font-serif text-2xl font-semibold tracking-[0.16em] text-primary uppercase focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none md:text-[1.7rem]"
        >
          {siteConfig.name}
        </Link>

        <DesktopNav items={items} />

        <div className="flex items-center gap-1">
          <Link href={account.href} className={iconLinkClass}>
            <UserRound aria-hidden="true" className="size-5" />
            {/* En el celular solo se ve el ícono; el nombre sigue disponible para lectores de pantalla. */}
            <span className="sr-only sm:not-sr-only">{account.label}</span>
          </Link>
          <CartLink className={iconLinkClass} />
          <MobileNav items={items} />
        </div>
      </div>
    </header>
  );
}
