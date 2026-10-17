"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/forms";
import { setOrderStatusAction } from "../admin-actions";
import { ORDER_ACTION_LABELS } from "../labels";

type Target = keyof typeof ORDER_ACTION_LABELS;

function ActionButton({ target }: { target: Target }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="status"
      value={target}
      variant={target === "cancelled" ? "outline" : "default"}
      disabled={pending}
      aria-disabled={pending}
    >
      {ORDER_ACTION_LABELS[target]}
    </Button>
  );
}

/** Botones para avanzar un pedido. Cancelar uno pagado pide confirmación. */
export function OrderStatusForm({ orderId, targets }: { orderId: string; targets: Target[] }) {
  const [state, formAction] = useActionState(setOrderStatusAction, initialFormState);
  if (targets.length === 0) return null;
  return (
    <form
      action={formAction}
      className="mt-3 grid gap-2"
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (
          submitter?.value === "cancelled" &&
          !window.confirm(
            "¿Cancelar este pedido pagado? Las unidades vuelven al stock y tendrás que devolver el dinero desde Wompi.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex flex-wrap gap-2">
        {targets.map((target) => (
          <ActionButton key={target} target={target} />
        ))}
      </div>
    </form>
  );
}
