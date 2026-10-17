import Link from "next/link";
import { siteConfig } from "@/config/site";
import { getCurrentUser, isAdminUser } from "@/modules/auth/session";

const linkClass =
  "inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const isAdmin = user ? await isAdminUser() : false;

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-2 px-4 py-2">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-lg font-semibold text-primary"
        >
          {siteConfig.name}
        </Link>
        <nav aria-label="Principal">
          <ul className="flex items-center gap-1">
            <li>
              <Link href="/agendar" className={linkClass}>
                Agendar
              </Link>
            </li>
            {isAdmin ? (
              <li>
                <Link href="/admin" className={linkClass}>
                  Panel
                </Link>
              </li>
            ) : null}
            <li>
              {user ? (
                <Link href="/cuenta" className={linkClass}>
                  Mi cuenta
                </Link>
              ) : (
                <Link href="/ingresar" className={linkClass}>
                  Ingresar
                </Link>
              )}
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
