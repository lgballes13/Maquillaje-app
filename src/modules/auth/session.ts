import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decideAdminAccess, type AdminAccess } from "./admin-access";

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Usuario actual o null. getClaims() verifica la firma del token: nunca confíes
 * en getSession() en el servidor, porque solo lee la cookie sin validarla.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
}

/** Exige sesión; si no hay, manda a /ingresar y luego regresa a `next`. */
export async function requireUser(next: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(next)}`);
  return user;
}

export async function getAdminAccess(): Promise<{ access: AdminAccess; user: SessionUser | null }> {
  const user = await getCurrentUser();
  if (!user) return { access: "login", user: null };

  const supabase = await createClient();
  const [{ data: hasAdminRole }, { data: aal }] = await Promise.all([
    supabase.rpc("has_role", { p_role: "admin" }),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  const access = decideAdminAccess({
    isLoggedIn: true,
    hasAdminRole: hasAdminRole === true,
    currentLevel: aal?.currentLevel,
    nextLevel: aal?.nextLevel,
  });
  return { access, user };
}

/**
 * Protege las páginas del panel. Solo deja pasar a un admin que verificó su
 * segundo factor en esta sesión; a los demás los manda a donde corresponda.
 */
export async function requireAdmin(next = "/admin"): Promise<SessionUser> {
  const { access, user } = await getAdminAccess();
  switch (access) {
    case "login":
      redirect(`/ingresar?next=${encodeURIComponent(next)}`);
    case "forbidden":
      notFound();
    case "enroll":
      redirect("/admin/seguridad");
    case "verify":
      redirect(`/admin/verificar?next=${encodeURIComponent(next)}`);
    case "allow":
      return user!;
  }
}

export async function isAdminUser(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_role", { p_role: "admin" });
  return data === true;
}
