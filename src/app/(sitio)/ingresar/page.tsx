import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { safeRedirectPath } from "@/lib/security/redirect";
import { SignInForm } from "@/modules/auth/components/sign-in-form";
import { getCurrentUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

const ERRORS: Record<string, string> = {
  enlace: "El enlace no es válido o ya venció. Intenta de nuevo.",
};

export default async function SignInPage({ searchParams }: PageProps<"/ingresar">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeRedirectPath(params.next) : undefined;

  if (await getCurrentUser()) redirect(next ?? "/cuenta");

  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <AuthCard
      title="Ingresar"
      description="Entra para agendar y ver tus citas y pedidos."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link
            href="/registro"
            className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
          >
            Crear cuenta
          </Link>
        </>
      }
    >
      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <SignInForm next={next} />
    </AuthCard>
  );
}
