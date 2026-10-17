"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { WEEKDAYS } from "@/lib/format";
import { initialFormState } from "@/lib/forms";
import { saveBusinessHoursAction } from "../actions";

export interface HourRow {
  weekday: number;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
}

// Orden de lunes a domingo, como se lee normalmente un horario.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function HoursForm({ hours }: { hours: HourRow[] }) {
  const [state, formAction] = useActionState(saveBusinessHoursAction, initialFormState);
  const byDay = new Map(hours.map((h) => [h.weekday, h]));

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <fieldset className="grid gap-3">
        <legend className="sr-only">Horario por día</legend>
        {DISPLAY_ORDER.map((weekday) => {
          const day = byDay.get(weekday)!;
          const name = WEEKDAYS[weekday];
          const error =
            state.fieldErrors?.[`closes_at-${weekday}`] ??
            state.fieldErrors?.[`opens_at-${weekday}`];
          return (
            <div
              key={weekday}
              className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[8rem_1fr_1fr] sm:items-center"
            >
              <label className="flex min-h-11 items-center gap-3 font-medium">
                <input
                  type="checkbox"
                  name={`open-${weekday}`}
                  defaultChecked={
                    state.values ? state.values[`open-${weekday}`] === "on" : day.is_open
                  }
                  className="size-5 accent-primary"
                />
                {name}
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Abre</span>
                <Input
                  type="time"
                  name={`opens-${weekday}`}
                  defaultValue={state.values?.[`opens-${weekday}`] ?? day.opens_at}
                  aria-label={`${name}: hora de apertura`}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Cierra</span>
                <Input
                  type="time"
                  name={`closes-${weekday}`}
                  defaultValue={state.values?.[`closes-${weekday}`] ?? day.closes_at}
                  aria-label={`${name}: hora de cierre`}
                  aria-invalid={error ? true : undefined}
                />
              </label>
              {error ? (
                <p className="text-sm font-medium text-destructive sm:col-span-3">
                  {name}: {error.join(" ")}
                </p>
              ) : null}
            </div>
          );
        })}
      </fieldset>
      <p className="text-sm text-muted-foreground">Desmarca un día para dejarlo cerrado.</p>
      <SubmitButton pendingText="Guardando…" className="sm:justify-self-start">
        Guardar horario
      </SubmitButton>
    </form>
  );
}
