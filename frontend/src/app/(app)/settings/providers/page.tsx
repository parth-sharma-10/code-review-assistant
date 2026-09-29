"use client";

import {
  CircleAlert,
  CircleCheck,
  Cloud,
  Cpu,
  MoreHorizontal,
  Pencil,
  PlugZap,
  Plus,
  Star,
  Trash2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DropdownMenu } from "radix-ui";
import { useState, type FormEvent } from "react";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Field,
  ICON_BUTTON,
  Page,
  PageHeader,
  SkeletonRows,
  TextInput,
  useReturnFocus,
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
  const returnFocus = useReturnFocus();

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
    <Page className="max-w-4xl">
      <PageHeader
        title="AI providers"
        description="Any server that implements the OpenAI chat-completions API works: OpenAI, LM Studio, Ollama, OpenRouter, vLLM and others. API keys are encrypted at rest and never shown again."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            Add provider
          </Button>
        }
      />

      {loading && <SkeletonRows rows={2} label="Loading providers" />}
      <ErrorNote>{error ?? actionError}</ErrorNote>
      {data && data.providers.length === 0 && (
        <EmptyState
          icon={PlugZap}
          title="No providers yet"
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              Add provider
            </Button>
          }
        >
          {data.environmentFallback
            ? `Reviews currently use the server default (${data.environmentFallback.model}). Add a provider to use your own.`
            : "Add one to run reviews and chat. For a free local setup, install Ollama and choose the Ollama preset."}
        </EmptyState>
      )}
      {data && data.providers.length > 0 && (
        <ul className="divide-y divide-rule overflow-hidden rounded-panel border border-rule bg-sheet shadow-panel">
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

      <Dialog.Root open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-ink/30" />
          <Dialog.Content
            {...returnFocus}
            aria-describedby={undefined}
            className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 animate-pop-in overflow-y-auto rounded-panel border border-rule bg-sheet shadow-pop"
          >
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
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name}?`}
        body="Its saved API key is deleted too. Past reviews keep the name of the model that produced them."
        confirmLabel="Delete provider"
        onConfirm={() => deleting && remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </Page>
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
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-panel border border-rule bg-paper text-ink-2">
        {p.type === "OLLAMA" || p.type === "LM_STUDIO" ? (
          <Cpu aria-hidden strokeWidth={1.75} className="size-4" />
        ) : (
          <Cloud aria-hidden strokeWidth={1.75} className="size-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="font-medium">{p.name}</span>
          {p.isDefault && (
            <span className="rounded-full border border-rule bg-paper px-2 font-mono text-[11px] text-ink-2">
              default
            </span>
          )}
        </p>
        <p className="truncate font-mono text-xs text-ink-3">
          {p.model} · {p.baseUrl} · {p.hasApiKey ? "key saved" : "no key"}
        </p>
        {status && status !== "testing" && (
          <p
            role="status"
            className={`mt-1 flex items-center gap-1.5 text-[13px] ${status.ok ? "text-ok" : "text-critical"}`}
          >
            {status.ok ? (
              <CircleCheck aria-hidden className="size-3.5" />
            ) : (
              <CircleAlert aria-hidden className="size-3.5" />
            )}
            {status.text}
          </p>
        )}
      </div>
      <Button size="sm" onClick={test} busy={status === "testing"}>
        {status !== "testing" && <Zap aria-hidden />}
        Test
      </Button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger aria-label={`Actions for ${p.name}`} className={ICON_BUTTON}>
          <MoreHorizontal aria-hidden className="size-4" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-40 animate-pop-in rounded-panel border border-rule bg-sheet p-1 shadow-pop"
          >
            {!p.isDefault && (
              <MenuItem icon={Star} onSelect={onMakeDefault}>
                Make default
              </MenuItem>
            )}
            <MenuItem icon={Pencil} onSelect={onEdit}>
              Edit
            </MenuItem>
            <DropdownMenu.Separator className="my-1 h-px bg-rule" />
            <MenuItem icon={Trash2} onSelect={onDelete} danger>
              Delete
            </MenuItem>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </li>
  );
}

function MenuItem({
  icon: Icon,
  onSelect,
  danger,
  children,
}: {
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={`flex cursor-default items-center gap-2 rounded-control px-2 py-1.5 text-sm outline-none data-highlighted:bg-wash ${danger ? "text-critical" : "text-ink"}`}
    >
      <Icon aria-hidden className="size-4 opacity-70" />
      {children}
    </DropdownMenu.Item>
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
    <form onSubmit={submit}>
      <div className="space-y-4 p-5">
        <Dialog.Title className="text-base font-semibold">
          {provider ? `Edit ${provider.name}` : "Add a provider"}
        </Dialog.Title>
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
      </div>
      <div className="flex justify-end gap-2 rounded-b-panel border-t border-rule bg-paper px-5 py-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={busy}>
          {provider ? "Save changes" : "Add provider"}
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
            className={`cursor-pointer rounded-control border px-2.5 py-1 text-[13px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${value === t ? "border-ink bg-ink text-sheet" : "border-rule bg-sheet hover:bg-paper"}`}
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
