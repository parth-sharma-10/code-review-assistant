"use client";

import { Check, CircleAlert, Copy, Loader2, type LucideIcon } from "lucide-react";
import { AlertDialog, Tooltip as RadixTooltip } from "radix-ui";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-sheet border border-ink hover:bg-ink/85 shadow-panel",
  secondary:
    "bg-sheet text-ink border border-rule hover:border-ink-3/60 hover:bg-paper shadow-panel",
  danger: "bg-sheet text-critical border border-critical/35 hover:bg-critical-tint",
  ghost: "text-ink-2 border border-transparent hover:text-ink hover:bg-wash",
};

const SIZES: Record<Size, string> = { sm: "h-7 px-2.5 text-[13px]", md: "h-8 px-3 text-sm" };

/** Shared by <Button> and by links that act as buttons, so both look and respond the same. */
export function buttonClass(variant: Variant = "secondary", className = "", size: Size = "md") {
  return `inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium transition-[background-color,border-color,transform,box-shadow] duration-100 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0 ${SIZES[size]} ${VARIANTS[variant]} ${className}`;
}

export function Button({
  variant = "secondary",
  size = "md",
  busy,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; busy?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
      className={buttonClass(variant, className, size)}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export const ICON_BUTTON =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-control text-ink-2 transition-colors hover:bg-wash hover:text-ink disabled:opacity-40";

/**
 * Square icon-only button. The label is required: it is the accessible name and the tooltip.
 * Not for Radix `asChild` triggers (the tooltip wrapper is not a DOM node); use ICON_BUTTON there.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon }
>(function IconButton({ label, icon: Icon, className = "", ...props }, ref) {
  return (
    <Tooltip label={label}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        {...props}
        className={`${ICON_BUTTON} ${className}`}
      >
        <Icon aria-hidden strokeWidth={1.75} className="size-4" />
      </button>
    </Tooltip>
  );
});

export function Tooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="z-50 animate-fade-in rounded-control bg-ink px-2 py-1 text-xs text-sheet shadow-pop"
        >
          {label}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export const TooltipProvider = RadixTooltip.Provider;

const FIELD =
  "w-full rounded-control border border-rule bg-sheet text-sm text-ink shadow-panel placeholder:text-ink-3 transition-[border-color,box-shadow] focus:border-ink-3 focus:shadow-[0_0_0_3px_rgb(21_27_43/0.08)] focus:outline-none disabled:bg-paper disabled:text-ink-3";

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-8 px-2.5 ${FIELD} ${className}`} />;
}

export function TextArea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`px-2.5 py-2 ${FIELD} ${className}`} />;
}

export function SelectInput({
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`h-8 px-2 ${FIELD} ${className}`} />;
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
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

/** A white surface on the canvas. Most content that is a unit (a table, a listing) sits in one. */
export function Panel({
  children,
  className = "",
  as: Tag = "div",
  ...props
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "header";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      {...props}
      className={`rounded-panel border border-rule bg-sheet shadow-panel ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Page frame: consistent width, gutters and entry fade for every non-workspace page. */
export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main className={`w-full max-w-6xl animate-fade-in px-4 pt-6 pb-16 sm:px-6 ${className}`}>
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 text-[22px] font-semibold tracking-tight">
          {icon}
          {title}
        </h1>
        {description && (
          <div className="mt-1 max-w-[72ch] text-sm leading-relaxed text-ink-2">{description}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Page-level wrapper for loading and error states in full-bleed layouts. */
export function Padded({ children }: { children: ReactNode }) {
  return <div className="max-w-6xl px-4 py-4 sm:px-6">{children}</div>;
}

export function Spinner() {
  return <Loader2 aria-hidden className="size-3.5 animate-spin" />;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-control border border-critical/25 bg-critical-tint px-3 py-2 text-sm text-critical"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
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

/** Grey placeholder bars in the shape of the content that is loading. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`block animate-pulse rounded-control bg-wash ${className}`} />
  );
}

export function SkeletonRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <Panel className="divide-y divide-rule" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2 px-4 py-3.5">
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
      ))}
    </Panel>
  );
}

/** Says what is missing and what to do next, with the one action that fixes it. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Panel className="flex flex-col items-start gap-3 px-6 py-8 sm:flex-row sm:items-center">
      {Icon && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-panel border border-rule bg-paper text-ink-2">
          <Icon aria-hidden strokeWidth={1.75} className="size-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{title}</p>
        {children && <div className="mt-0.5 max-w-prose text-sm text-ink-2">{children}</div>}
      </div>
      {action}
    </Panel>
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
    <>
      <IconButton
        label={copied ? "Copied" : label}
        icon={copied ? Check : Copy}
        onClick={copy}
        className={`size-6 [&>svg]:size-3.5 ${copied ? "text-ok" : "text-ink-3"}`}
      />
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}

/**
 * Dialogs opened from state (no Radix Trigger) lose focus to <body> on close. Remember what was
 * focused when the dialog opened and put focus back there, so keyboard users keep their place.
 */
export function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      opener.current = document.activeElement as HTMLElement | null;
    },
    onCloseAutoFocus: (e: Event) => {
      if (!opener.current?.isConnected) return;
      e.preventDefault();
      opener.current.focus();
    },
  };
}

/** Radix AlertDialog: focus trap, Escape, and focus back to whatever opened it. */
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
  const returnFocus = useReturnFocus();
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-ink/30" />
        <AlertDialog.Content
          {...returnFocus}
          className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 animate-pop-in rounded-panel border border-rule bg-sheet text-ink shadow-pop"
        >
          <div className="space-y-2 p-5">
            <AlertDialog.Title className="text-base font-semibold">{title}</AlertDialog.Title>
            <AlertDialog.Description className="text-sm leading-relaxed text-ink-2">
              {body}
            </AlertDialog.Description>
          </div>
          <div className="flex justify-end gap-2 rounded-b-panel border-t border-rule bg-paper px-5 py-3">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" disabled={busy}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button variant="danger" onClick={onConfirm} busy={busy}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
