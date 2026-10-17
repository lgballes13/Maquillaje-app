"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { setWorkPublishedAction } from "../admin-actions";

/** Publicar u ocultar un trabajo. La base revisa la autorización y la foto de «después». */
export function PublishForm({ workId, published }: { workId: string; published: boolean }) {
  const [state, formAction] = useActionState(setWorkPublishedAction, initialFormState);
  return (
    <form action={formAction} className="grid gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="workId" value={workId} />
      <input type="hidden" name="publish" value={published ? "no" : "yes"} />
      <SubmitButton pendingText="Guardando…" className="sm:justify-self-start">
        {published ? "Ocultar del portafolio" : "Publicar en el portafolio"}
      </SubmitButton>
    </form>
  );
}
