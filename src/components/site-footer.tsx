import Link from "next/link";
import { siteConfig } from "@/config/site";

const LINKS = [
  { href: "/terminos", label: "Términos y condiciones" },
  { href: "/privacidad", label: "Política de tratamiento de datos" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
      <p>
        © {new Date().getFullYear()} {siteConfig.name}
      </p>
      <nav aria-label="Información legal" className="mt-2">
        <ul className="flex flex-wrap justify-center gap-x-4">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
