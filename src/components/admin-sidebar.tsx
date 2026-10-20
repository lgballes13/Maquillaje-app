"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  ChartColumn,
  Images,
  LayoutDashboard,
  Menu,
  Package,
  Scissors,
  Settings2,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    title: "General",
    items: [
      { href: "/admin", label: "Resumen", icon: LayoutDashboard },
      { href: "/admin/reportes", label: "Reportes", icon: ChartColumn },
    ],
  },
  {
    title: "Citas",
    items: [
      { href: "/admin/agenda", label: "Agenda", icon: CalendarRange },
      { href: "/admin/citas", label: "Citas", icon: CalendarDays },
      { href: "/admin/clientas", label: "Clientas", icon: Users },
    ],
  },
  {
    title: "Tienda",
    items: [
      { href: "/admin/productos", label: "Productos", icon: Package },
      { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
    ],
  },
  {
    title: "Portafolio",
    items: [{ href: "/admin/portafolio", label: "Portafolio", icon: Images }],
  },
  {
    title: "Configuración",
    items: [
      { href: "/admin/servicios", label: "Servicios", icon: Scissors },
      { href: "/admin/reglas", label: "Reglas del negocio", icon: Settings2 },
    ],
  },
] as const;

/** «Resumen» solo se marca en /admin; las demás también en sus subpáginas. */
function isCurrent(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Barra lateral del panel: fija en pantallas grandes y desplegable en el celular. */
export function AdminSidebar() {
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
    <div className="border-b border-gold/30 bg-card lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
      <div className="px-4 py-2 lg:hidden">
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpenedAt(pathname);
            setOpen((value) => !value);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-plum transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {open ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
          Menú del panel
        </button>
      </div>
      <nav
        id={panelId}
        aria-label="Secciones del panel"
        className={cn("px-3 pb-4 lg:sticky lg:top-0 lg:block lg:py-6", !open && "hidden")}
      >
        {GROUPS.map((group) => (
          <div key={group.title} className="mt-4 first:mt-0">
            <p className="px-3 text-xs font-semibold tracking-[0.2em] text-gold-foreground uppercase">
              {group.title}
            </p>
            <ul className="mt-1">
              {group.items.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isCurrent(pathname, href) ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground/85 transition-colors hover:bg-accent hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
