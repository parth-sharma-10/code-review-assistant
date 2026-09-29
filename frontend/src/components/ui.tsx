"use client";

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-sheet hover:bg-ink/85 border border-ink",
  secondary: "bg-sheet text-ink border border-rule hover:border-ink-3 hover:bg-wash",
  danger: "bg-sheet text-critical border border-critical/40 hover:bg-critical-tint",
  ghost: "text-ink-2 hover:text-ink hover:bg-wash border border-transparent",
};

/** Shared by <Button> and by links that act as buttons, so both look and respond the same. */
export function buttonClass(variant: Variant = "secondary", className = "") {
  return `inline-flex h-8 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[4px] px-3 text-sm font-medium transition-[background-color,border-color,transform] duration-100 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`;
}

export function Button({
  variant = "secondary",
  busy,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
      className={buttonClass(variant, className)}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-[4px] border border-rule bg-sheet px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

/** Page-level wrapper for loading and error states in full-bleed layouts. */
export function Padded({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 py-4">{children}</div>;
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-[4px] border border-critical/30 bg-critical-tint px-3 py-2 text-sm text-critical"
    >
      {children}
    </p>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 py-8 text-sm text-ink-3" role="status">
      <Spinner /> {label}…
    </p>
  );
}

/** Left-aligned, like the content it stands in for; says what to do next. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-y border-rule py-8">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-prose text-sm text-ink-2">{children}</div>}
    </div>
  );
}

/** Copies text and confirms in place; the confirmation is announced to screen readers. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions); the text stays selectable.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className="inline-flex h-6 items-center rounded-[3px] px-1.5 font-sans text-xs text-ink-3 hover:bg-wash hover:text-ink"
    >
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

/** Native <dialog>: focus trapping, Escape and the backdrop come from the browser. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[6px] border border-rule bg-sheet p-0 text-ink shadow-lg"
    >
      <div className="space-y-3 p-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="text-sm text-ink-2">{body}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-rule px-5 py-3">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} busy={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
