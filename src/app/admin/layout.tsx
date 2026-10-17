import type { Metadata } from "next";
import Link from "next/link";
import { signOutAction } from "@/modules/auth/actions";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s | Panel" },
  // El panel nunca debe aparecer en buscadores.
  robots: { index: false, follow: false },
};

const linkClass =
  "inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="border-b border-border bg-foreground text-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link href="/admin" className="inline-flex min-h-11 items-center font-semibold">
            Panel de administración
          </Link>
          <nav aria-label="Panel">
            <ul className="flex items-center gap-1">
              <li>
                <Link href="/" className={`${linkClass} hover:text-foreground`}>
                  Ver sitio
                </Link>
              </li>
              <li>
                <form action={signOutAction}>
                  <button type="submit" className={`${linkClass} hover:text-foreground`}>
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
