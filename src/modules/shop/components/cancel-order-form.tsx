"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { initialFormState } from "@/lib/forms";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cancelOrderAction } from "../actions";

function CancelButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending} aria-disabled={pending}>
      {pending ? "Cancelando…" : "Cancelar pedido"}
    </Button>
  );
}

/** La clienta cancela un pedido sin pagar y libera las unidades. */
export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(cancelOrderAction, initialFormState);
  return (
    <form action={formAction} className="mt-4 grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <CancelButton />
      </div>
    </form>
  );
}
