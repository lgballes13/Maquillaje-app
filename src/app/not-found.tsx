import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="contenido"
      className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center"
    >
      <h1 className="text-2xl font-bold">No encontramos esta página</h1>
      <p className="text-muted-foreground mt-2">
        Puede que el enlace esté mal escrito o que la página ya no exista.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
