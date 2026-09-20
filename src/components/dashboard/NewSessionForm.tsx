"use client";

import { Button } from "@/components/ui/Button";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { FieldInput, FieldLabel, FieldTextarea } from "@/components/ui/Field";
import { TARGET_LEVELS, type TargetLevel } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

type NewSessionFormProps = {
  defaultTargetLevel: TargetLevel;
};

export function NewSessionForm({ defaultTargetLevel }: NewSessionFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("Design LeetCode");
  const [targetLevel, setTargetLevel] = useState<TargetLevel>(defaultTargetLevel);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, problem, targetLevel }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to create session");
        return;
      }
      const session = (await res.json()) as { id: string };
      router.push(`/interview/${session.id}`);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        className="gap-2 shadow-sm"
        onClick={() => setOpen(true)}
      >
        <MaterialIcon name="add" className="text-[18px]" />
        New interview
      </Button>
    );
  }

  const inputClass =
    "w-full rounded-[6px] border border-border bg-white px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-foreground";

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 rounded-[6px] border border-border bg-white p-6"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        New interview
      </p>
      <div className="mt-4 space-y-4">
        <FieldInput
          label="Title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. LeetCode system design"
        />
        <FieldTextarea
          label="Problem"
          name="problem"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          rows={4}
        />
        <div>
          <FieldLabel label="Target level" htmlFor="targetLevel" />
          <select
            id="targetLevel"
            className={inputClass}
            value={targetLevel}
            onChange={(e) => setTargetLevel(e.target.value as TargetLevel)}
          >
            {TARGET_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <p className="text-sm text-foreground font-medium">{error}</p>
        ) : null}
        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Start interview"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
