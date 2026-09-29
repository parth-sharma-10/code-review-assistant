"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FolderPlus } from "lucide-react";
import { useShell } from "@/components/shell";
import {
  Button,
  ErrorNote,
  Field,
  Page,
  PageHeader,
  Panel,
  TextArea,
  TextInput,
} from "@/components/ui";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

export default function NewProjectPage() {
  const router = useRouter();
  const { reloadProjects } = useShell();
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
      reloadProjects();
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Page className="max-w-xl">
      <PageHeader
        icon={<FolderPlus aria-hidden strokeWidth={1.75} className="size-6 text-ink-2" />}
        title="New project"
        description="A project holds one repository. You upload its source as a ZIP on the next screen."
      />
      <Panel as="section">
        <form onSubmit={submit}>
          <div className="space-y-4 p-5">
            <Field label="Name">
              <TextInput
                name="name"
                required
                maxLength={100}
                autoFocus
                placeholder="payments-api"
                className="font-mono"
              />
            </Field>
            <Field label="Description" hint="Optional. Up to 1,000 characters.">
              <TextArea name="description" maxLength={1000} rows={3} />
            </Field>
            <ErrorNote>{error}</ErrorNote>
          </div>
          <div className="flex justify-end gap-2 rounded-b-panel border-t border-rule bg-paper px-5 py-3">
            <Button variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" busy={busy}>
              Create project
            </Button>
          </div>
        </form>
      </Panel>
    </Page>
  );
}
