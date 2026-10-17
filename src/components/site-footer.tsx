import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
      <p>
        © {new Date().getFullYear()} {siteConfig.name}
      </p>
      <p className="mt-2">
        <Link
          href="/privacidad"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          Política de tratamiento de datos
        </Link>
      </p>
    </footer>
  );
}
