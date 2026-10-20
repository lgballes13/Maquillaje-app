import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { signOutAction } from "@/modules/auth/actions";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s | Panel" },
  // El panel nunca debe aparecer en buscadores.
  robots: { index: false, follow: false },
};

const linkClass =
  "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium transition-colors hover:bg-plum-foreground/10 focus-visible:ring-[3px] focus-visible:ring-gold/60 focus-visible:outline-none";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="border-b border-gold/40 bg-plum text-plum-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 lg:px-6">
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-baseline gap-2 rounded-md focus-visible:ring-[3px] focus-visible:ring-gold/60 focus-visible:outline-none"
          >
            <span className="font-serif text-xl tracking-[0.18em] uppercase">
              {siteConfig.name}
            </span>
            <span className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
              Panel
            </span>
          </Link>
          <nav aria-label="Panel">
            <ul className="flex items-center gap-1">
              <li>
                <Link href="/" className={linkClass}>
                  Ver sitio
                </Link>
              </li>
              <li>
                <form action={signOutAction}>
                  <button type="submit" className={linkClass}>
                    Cerrar sesión
                  </button>
                </form>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
