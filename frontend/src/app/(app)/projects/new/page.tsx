"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ErrorNote, Field, TextInput } from "@/components/ui";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

export default function NewProjectPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const project = await api<Project>("/projects", {
        body: { name: form.get("name"), description: form.get("description") || undefined },
      });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">New project</h1>
      <p className="mt-1 text-sm text-ink-2">
        You will upload the source code as a ZIP on the next screen.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Name">
          <TextInput name="name" required maxLength={100} autoFocus placeholder="payments-api" />
        </Field>
        <Field label="Description" hint="Optional. Up to 1,000 characters.">
          <textarea
            name="description"
            maxLength={1000}
            rows={3}
            className="w-full rounded-[4px] border border-rule bg-sheet px-2.5 py-1.5 text-sm focus:border-ink focus:outline-none"
          />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" busy={busy}>
            Create project
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}
