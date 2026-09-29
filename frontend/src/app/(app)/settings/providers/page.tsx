"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  TextInput,
} from "@/components/ui";
import { api } from "@/lib/api";
import type { Provider, ProvidersResponse, ProviderType } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** Presets only fill in the form; every provider uses the same OpenAI-compatible client. */
const PRESETS: Record<
  ProviderType,
  { label: string; baseUrl: string; model: string; keyHint: string }
> = {
  OPENAI: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    keyHint: "Required.",
  },
  LM_STUDIO: {
    label: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    model: "",
    keyHint: "Not needed for a local server.",
  },
  OLLAMA: {
    label: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    model: "qwen2.5-coder:7b",
    keyHint: "Not needed for a local server.",
  },
  OPENROUTER: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "",
    keyHint: "Required.",
  },
  CUSTOM: {
    label: "Other OpenAI-compatible",
    baseUrl: "",
    model: "",
    keyHint: "If the endpoint requires one.",
  },
};

export default function ProvidersPage() {
  const { data, error, loading, reload } = useApi<ProvidersResponse>("/ai/providers");
  const [editing, setEditing] = useState<Provider | "new" | null>(null);
  const [deleting, setDeleting] = useState<Provider | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function act(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function remove(p: Provider) {
    setDeleting(null);
    await act(() => api(`/ai/providers/${p.id}`, { method: "DELETE" }));
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">AI providers</h1>
          <p className="mt-1 max-w-prose text-sm text-ink-2">
            Any server that implements the OpenAI chat-completions API works: OpenAI, LM Studio,
            Ollama, OpenRouter, vLLM and others. API keys are encrypted at rest and never shown
            again after saving.
          </p>
        </div>
        {editing === null && (
          <Button variant="primary" onClick={() => setEditing("new")}>
            Add provider
          </Button>
        )}
      </div>

      {editing && (
        <ProviderForm
          provider={editing === "new" ? null : editing}
          onDone={() => {
            setEditing(null);
            reload();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading && <Loading label="Loading providers" />}
      <ErrorNote>{error ?? actionError}</ErrorNote>
      {data && data.providers.length === 0 && editing === null && (
        <EmptyState title="No providers yet">
          {data.environmentFallback
            ? `Reviews currently use the server default (${data.environmentFallback.model}). Add a provider to use your own.`
            : "Add one to run reviews and chat. For a free local setup, install Ollama and choose the Ollama preset."}
        </EmptyState>
      )}
      {data && data.providers.length > 0 && (
        <ul className="divide-y divide-rule rounded-[4px] border border-rule bg-sheet">
          {data.providers.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              onEdit={() => setEditing(p)}
              onDelete={() => setDeleting(p)}
              onMakeDefault={() =>
                act(() =>
                  api(`/ai/providers/${p.id}`, { method: "PATCH", body: { isDefault: true } }),
                )
              }
            />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name}?`}
        body="Its saved API key is deleted too. Past reviews keep the name of the model that produced them."
        confirmLabel="Delete provider"
        onConfirm={() => deleting && remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </main>
  );
}

type TestStatus = { ok: boolean; text: string } | "testing" | null;

function ProviderRow({
  provider: p,
  onEdit,
  onDelete,
  onMakeDefault,
}: {
  provider: Provider;
  onEdit: () => void;
  onDelete: () => void;
  onMakeDefault: () => void;
}) {
  const [status, setStatus] = useState<TestStatus>(null);

  async function test() {
    setStatus("testing");
    try {
      const r = await api<{ latencyMs: number }>(`/ai/providers/${p.id}/test`, { method: "POST" });
      setStatus({ ok: true, text: `Connected in ${(r.latencyMs / 1000).toFixed(1)}s` });
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
    }
  }

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="font-medium">{p.name}</span>
          {p.isDefault && (
            <span className="ml-2 rounded-[3px] bg-marker px-1.5 py-0.5 text-xs">default</span>
          )}
        </p>
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" onClick={test} busy={status === "testing"}>
            Test connection
          </Button>
          {!p.isDefault && (
            <Button variant="ghost" onClick={onMakeDefault}>
              Make default
            </Button>
          )}
          <Button variant="ghost" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
      <p className="font-mono text-xs text-ink-3">
        {PRESETS[p.type].label} · {p.model} · {p.baseUrl} · {p.hasApiKey ? "key saved" : "no key"}
      </p>
      {status && status !== "testing" && (
        <p role="status" className={`text-sm ${status.ok ? "text-ok" : "text-critical"}`}>
          {status.text}
        </p>
      )}
    </li>
  );
}

function ProviderForm({
  provider,
  onDone,
  onCancel,
}: {
  provider: Provider | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<ProviderType>(provider?.type ?? "OLLAMA");
  const [form, setForm] = useState({
    name: provider?.name ?? PRESETS.OLLAMA.label,
    baseUrl: provider?.baseUrl ?? PRESETS.OLLAMA.baseUrl,
    model: provider?.model ?? PRESETS.OLLAMA.model,
    apiKey: "",
  });
  const [clearKey, setClearKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choosePreset(t: ProviderType) {
    setType(t);
    // Presets fill a new provider's fields; they never overwrite an existing one's.
    if (!provider) {
      const { label, baseUrl, model } = PRESETS[t];
      setForm({ name: label, baseUrl, model, apiKey: form.apiKey });
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // On edit, an empty key field means "keep the saved key".
    const body = { ...form, type, apiKey: clearKey ? "" : form.apiKey || undefined };
    try {
      await (provider
        ? api(`/ai/providers/${provider.id}`, { method: "PATCH", body })
        : api("/ai/providers", { body }));
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[4px] border border-rule bg-sheet p-4">
      <h2 className="font-semibold">{provider ? `Edit ${provider.name}` : "Add provider"}</h2>
      <PresetPicker value={type} onChange={choosePreset} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <TextInput value={form.name} onChange={set("name")} required maxLength={100} />
        </Field>
        <Field
          label="Model"
          hint="Exactly as the server names it, e.g. gpt-4o-mini or qwen2.5-coder:7b."
        >
          <TextInput
            value={form.model}
            onChange={set("model")}
            required
            maxLength={200}
            className="font-mono"
          />
        </Field>
      </div>
      <Field label="Base URL" hint="The part before /chat/completions.">
        <TextInput
          value={form.baseUrl}
          onChange={set("baseUrl")}
          required
          type="url"
          className="font-mono"
        />
      </Field>
      <KeyField
        value={form.apiKey}
        onChange={set("apiKey")}
        hasSavedKey={Boolean(provider?.hasApiKey)}
        hint={PRESETS[type].keyHint}
        clearKey={clearKey}
        onClearKeyChange={setClearKey}
      />
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" busy={busy}>
          {provider ? "Save changes" : "Add provider"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PresetPicker({
  value,
  onChange,
}: {
  value: ProviderType;
  onChange: (type: ProviderType) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Preset</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PRESETS) as ProviderType[]).map((t) => (
          <label
            key={t}
            className={`cursor-pointer rounded-[4px] border px-2.5 py-1 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${value === t ? "border-ink bg-wash" : "border-rule hover:bg-wash"}`}
          >
            <input
              type="radio"
              name="preset"
              className="sr-only"
              checked={value === t}
              onChange={() => onChange(t)}
            />
            {PRESETS[t].label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** On edit, a blank key keeps the saved one; the checkbox removes it. */
function KeyField({
  value,
  onChange,
  hasSavedKey,
  hint,
  clearKey,
  onClearKeyChange,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hasSavedKey: boolean;
  hint: string;
  clearKey: boolean;
  onClearKeyChange: (clear: boolean) => void;
}) {
  return (
    <>
      <Field label="API key" hint={hasSavedKey ? "A key is saved. Leave blank to keep it." : hint}>
        <TextInput
          value={value}
          onChange={onChange}
          type="password"
          autoComplete="off"
          maxLength={500}
          disabled={clearKey}
          className="font-mono"
        />
      </Field>
      {hasSavedKey && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={clearKey}
            onChange={(e) => onClearKeyChange(e.target.checked)}
            className="accent-ink"
          />
          Remove the saved key
        </label>
      )}
    </>
  );
}
