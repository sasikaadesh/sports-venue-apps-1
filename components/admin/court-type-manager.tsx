"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Pencil, Plus, Shapes, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { EmptyState } from "@/components/admin/page-header";
import { courtTypeSchema, type CourtTypeInput } from "@/lib/validations";
import {
  createCourtType,
  deleteCourtType,
  updateCourtType,
} from "@/app/admin/court-types/actions";

export type CourtTypeRow = {
  id: string;
  name: string;
  playerOptions: number[];
  courtCount: number;
};

/** Chip editor for the allowed player counts (Tennis -> 2, 4). */
function PlayerOptionsField({
  value,
  onChange,
  error,
}: {
  value: number[];
  onChange: (next: number[]) => void;
  error?: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const n = Number(draft);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      toast.error("Enter a whole number between 1 and 100.");
      return;
    }
    if (value.includes(n)) {
      toast.error(`${n} is already in the list.`);
      return;
    }
    onChange([...value, n].sort((a, b) => a - b));
    setDraft("");
  }

  return (
    <Field data-invalid={!!error}>
      <FieldLabel className="text-sm font-medium">
        Allowed player counts
      </FieldLabel>

      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((n) => (
          <span
            key={n}
            className="inline-flex items-center gap-1 rounded-lg bg-secondary py-1 pr-1 pl-2.5 text-sm font-medium"
          >
            {n}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== n))}
              className="grid size-5 place-items-center text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
              aria-label={`Remove ${n} players`}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}

        <span className="flex items-center gap-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter must not submit the whole form from inside this sub-input.
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            inputMode="numeric"
            placeholder="Add"
            className="h-8 w-20 rounded-lg"
            aria-label="Player count to add"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={add}
            aria-label="Add player count"
          >
            <Plus />
          </Button>
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        These become the &quot;number of players&quot; dropdown options when
        someone books this type of court.
      </p>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

function CourtTypeForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  defaultValues: CourtTypeInput;
  submitLabel: string;
  onSubmit: (values: CourtTypeInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const form = useForm<CourtTypeInput>({
    resolver: zodResolver(courtTypeSchema),
    defaultValues,
  });

  // useWatch, not form.watch() — the latter returns a fresh function each
  // render, which makes React Compiler bail out of memoizing this component.
  const playerOptions =
    useWatch({ control: form.control, name: "playerOptions" }) ?? [];

  return (
    <form
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          await onSubmit(values);
        })
      )}
      className="flex flex-col gap-5"
    >
      <Field data-invalid={!!form.formState.errors.name}>
        <FieldLabel htmlFor="ct-name" className="text-sm font-medium">
          Name
        </FieldLabel>
        <Input
          id="ct-name"
          placeholder="Tennis"
          className="h-10 rounded-xl"
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <FieldError>{form.formState.errors.name.message}</FieldError>
        )}
      </Field>

      <PlayerOptionsField
        value={playerOptions}
        onChange={(next) =>
          form.setValue("playerOptions", next, { shouldValidate: true })
        }
        error={form.formState.errors.playerOptions?.message}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending} className="h-10">
          <Check />
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export function CourtTypeManager({
  courtTypes,
}: {
  courtTypes: CourtTypeRow[];
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDelete(row: CourtTypeRow) {
    startTransition(async () => {
      const result = await deleteCourtType(row.id);
      if (result.ok) toast.success(`Deleted "${row.name}".`);
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {creating ? (
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-5 text-base font-medium">New court type</h2>
          <CourtTypeForm
            defaultValues={{ name: "", playerOptions: [] }}
            submitLabel="Create court type"
            onCancel={() => setCreating(false)}
            onSubmit={async (values) => {
              const result = await createCourtType(values);
              if (result.ok) {
                toast.success(`Created "${values.name}".`);
                setCreating(false);
              } else {
                toast.error(result.error);
              }
            }}
          />
        </div>
      ) : (
        <div>
          <Button onClick={() => setCreating(true)} className="h-10">
            <Plus />
            New court type
          </Button>
        </div>
      )}

      {courtTypes.length === 0 ? (
        <EmptyState
          icon={<Shapes className="size-5" />}
          title="No court types yet"
          description="A court type groups courts that play the same sport and share the same player-count options — Tennis, Cricket, Table Tennis. Every court belongs to one."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {courtTypes.map((row) => (
            <li key={row.id} className="rounded-xl border bg-card">
              {editingId === row.id ? (
                <div className="p-6">
                  <h2 className="mb-5 text-base font-medium">
                    Edit &quot;{row.name}&quot;
                  </h2>
                  <CourtTypeForm
                    defaultValues={{
                      name: row.name,
                      playerOptions: row.playerOptions,
                    }}
                    submitLabel="Save changes"
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (values) => {
                      const result = await updateCourtType(row.id, values);
                      if (result.ok) {
                        toast.success("Court type updated.");
                        setEditingId(null);
                      } else {
                        toast.error(result.error);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.courtCount}{" "}
                        {row.courtCount === 1 ? "court" : "courts"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.playerOptions.length === 0 ? (
                        <span className="text-xs text-destructive">
                          No player options set
                        </span>
                      ) : (
                        row.playerOptions.map((n) => (
                          <Badge key={n} variant="secondary">
                            {n} players
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditingId(row.id)}
                      aria-label={`Edit ${row.name}`}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(row)}
                      aria-label={`Delete ${row.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
