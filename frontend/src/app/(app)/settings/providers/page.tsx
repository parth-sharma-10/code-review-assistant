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
  const [status, setStatus] = useState<Record<string, { ok: boolean; text: string } | "testing">>(
    {},
  );

  async function test(p: Provider) {
    setStatus((s) => ({ ...s, [p.id]: "testing" }));
    try {
      const r = await api<{ latencyMs: number; reply: string }>(`/ai/providers/${p.id}/test`, {
        method: "POST",
      });
      setStatus((s) => ({
        ...s,
        [p.id]: { ok: true, text: `Connected in ${(r.latencyMs / 1000).toFixed(1)}s` },
      }));
    } catch (err) {
      setStatus((s) => ({ ...s, [p.id]: { ok: false, text: (err as Error).message } }));
    }
  }

  async function makeDefault(p: Provider) {
    await api(`/ai/providers/${p.id}`, { method: "PATCH", body: { isDefault: true } });
    reload();
  }

  async function remove() {
    if (!deleting) return;
    await api(`/ai/providers/${deleting.id}`, { method: "DELETE" });
    setDeleting(null);
    reload();
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
      <ErrorNote>{error}</ErrorNote>
      {data && data.providers.length === 0 && editing === null && (
        <EmptyState title="No providers yet">
          {data.environmentFallback
            ? `Reviews currently use the server default (${data.environmentFallback.model}). Add a provider to use your own.`
            : "Add one to run reviews and chat. For a free local setup, install Ollama and choose the Ollama preset."}
        </EmptyState>
      )}
      {data && data.providers.length > 0 && (
        <ul className="divide-y divide-rule rounded-[4px] border border-rule bg-sheet">
          {data.providers.map((p) => {
            const s = status[p.id];
            return (
              <li key={p.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p>
                    <span className="font-medium">{p.name}</span>
                    {p.isDefault && (
                      <span className="ml-2 rounded-[3px] bg-marker px-1.5 py-0.5 text-xs">
                        default
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" onClick={() => test(p)} busy={s === "testing"}>
                      Test connection
                    </Button>
                    {!p.isDefault && (
                      <Button variant="ghost" onClick={() => makeDefault(p)}>
                        Make default
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => setEditing(p)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => setDeleting(p)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="font-mono text-xs text-ink-3">
                  {PRESETS[p.type].label} · {p.model} · {p.baseUrl} ·{" "}
                  {p.hasApiKey ? "key saved" : "no key"}
                </p>
                {s && s !== "testing" && (
                  <p role="status" className={`text-sm ${s.ok ? "text-ok" : "text-critical"}`}>
                    {s.text}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name}?`}
        body="Its saved API key is deleted too. Past reviews keep the name of the model that produced them."
        confirmLabel="Delete provider"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </main>
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
    if (!provider)
      setForm({
        name: PRESETS[t].label,
        baseUrl: PRESETS[t].baseUrl,
        model: PRESETS[t].model,
        apiKey: form.apiKey,
      });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // On edit, an empty key field means "keep the saved key".
    const apiKey = clearKey ? "" : form.apiKey || undefined;
    try {
      if (provider) {
        await api(`/ai/providers/${provider.id}`, {
          method: "PATCH",
          body: { ...form, type, apiKey },
        });
      } else {
        await api("/ai/providers", { body: { ...form, type, apiKey } });
      }
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
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Preset</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRESETS) as ProviderType[]).map((t) => (
            <label
              key={t}
              className={`cursor-pointer rounded-[4px] border px-2.5 py-1 text-sm ${type === t ? "border-ink bg-wash" : "border-rule hover:bg-wash"}`}
            >
              <input
                type="radio"
                name="preset"
                className="sr-only"
                checked={type === t}
                onChange={() => choosePreset(t)}
              />
              {PRESETS[t].label}
            </label>
          ))}
        </div>
      </fieldset>
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
      <Field
        label="API key"
        hint={
          provider?.hasApiKey ? "A key is saved. Leave blank to keep it." : PRESETS[type].keyHint
        }
      >
        <TextInput
          value={form.apiKey}
          onChange={set("apiKey")}
          type="password"
          autoComplete="off"
          maxLength={500}
          disabled={clearKey}
          className="font-mono"
        />
      </Field>
      {provider?.hasApiKey && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={clearKey}
            onChange={(e) => setClearKey(e.target.checked)}
            className="accent-ink"
          />
          Remove the saved key
        </label>
      )}
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
