"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
}

/** La sección actual se marca con aria-current (también la sección padre: /tienda/abc → Tienda). */
function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Menú principal en pantallas medianas y grandes. */
export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="hidden md:block">
      <ul className="flex items-center gap-1 lg:gap-3">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
              className="group relative inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium tracking-wide text-foreground/85 transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:text-primary"
            >
              {item.label}
              {/* Subrayado dorado: crece al pasar el mouse y queda fijo en la sección actual. */}
              <span
                aria-hidden="true"
                className="absolute inset-x-3 bottom-2 h-px origin-left scale-x-0 bg-gold transition-transform duration-300 group-hover:scale-x-100 group-aria-[current=page]:scale-x-100"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Botón de menú y panel desplegable para el celular. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Al cambiar de página el menú se cierra solo.
  if (open && openedAt !== pathname) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((value) => !value);
        }}
        className="inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {open ? (
          <X aria-hidden="true" className="size-5" />
        ) : (
          <Menu aria-hidden="true" className="size-5" />
        )}
        <span className="sr-only">Menú</span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-gold/40 bg-background shadow-lg shadow-plum/10"
      >
        <nav aria-label="Principal" className="mx-auto max-w-6xl px-4 py-3">
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center justify-between rounded-md px-2 font-serif text-xl text-foreground transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:text-primary"
                >
                  {item.label}
                  <span aria-hidden="true" className="text-gold">
                    ✦
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
