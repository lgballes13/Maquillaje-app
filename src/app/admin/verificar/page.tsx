import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { safeRedirectPath } from "@/lib/security/redirect";
import { TotpChallenge } from "@/modules/admin/components/totp-challenge";
import { getAdminAccess } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Código de verificación" };

export default async function AdminVerifyPage({ searchParams }: PageProps<"/admin/verificar">) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next, "/admin");

  const { access } = await getAdminAccess();
  if (access === "login") redirect(`/ingresar?next=${encodeURIComponent(next)}`);
  if (access === "forbidden") notFound();
  if (access === "enroll") redirect("/admin/seguridad");
  if (access === "allow") redirect(next);

  return (
    <AuthCard
      title="Código de verificación"
      description="Abre tu app autenticadora y escribe el código de 6 números que aparece para esta cuenta."
    >
      <TotpChallenge next={next} />
    </AuthCard>
  );
}
