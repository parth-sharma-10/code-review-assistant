"use client";

import { ArrowUp, FileCode2, MessagesSquare, Plus } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { FileIcon } from "@/components/icons";
import { useProject } from "@/components/project-context";
import { ProviderSelect } from "@/components/provider-select";
import { Button, buttonClass, EmptyState, ErrorNote, Page, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { formatShortDate } from "@/lib/format";
import type { ChatMessage, ChatSession } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const EXAMPLES = [
  "Explain how authentication works.",
  "Which file handles database connections?",
  "Where is input validated?",
];

export default function ChatPage() {
  const { project } = useProject();
  const sessions = useApi<ChatSession[]>(`/projects/${project.id}/chat/sessions`);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sessionId = activeId ?? sessions.data?.[0]?.id ?? null;

  async function newChat() {
    const s = await api<ChatSession>(`/projects/${project.id}/chat/sessions`, { method: "POST" });
    sessions.setData((prev) => [s, ...(prev ?? [])]);
    setActiveId(s.id);
  }

  if (project._count.files === 0) {
    return (
      <Page>
        <EmptyState
          icon={MessagesSquare}
          title="Nothing to chat about yet"
          action={
            <Link href={`/projects/${project.id}`} className={buttonClass("primary")}>
              Upload source
            </Link>
          }
        >
          Chat answers from the uploaded files, so upload the repository first.
        </EmptyState>
      </Page>
    );
  }

  return (
    <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-rule bg-rail p-3 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <Button onClick={newChat} className="mb-3 w-full">
          <Plus aria-hidden />
          New chat
        </Button>
        {sessions.loading && (
          <div className="space-y-2 px-2" role="status" aria-label="Loading chats">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        )}
        <ul className="space-y-px">
          {sessions.data?.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setActiveId(s.id)}
                aria-current={s.id === sessionId ? "true" : undefined}
                className="w-full rounded-control px-2.5 py-2 text-left text-sm text-ink-2 hover:bg-wash aria-[current=true]:bg-sheet aria-[current=true]:text-ink aria-[current=true]:shadow-panel"
              >
                <span className="block truncate">{s.title}</span>
                <span className="block font-mono text-[11px] text-ink-3">
                  {formatShortDate(s.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {sessionId ? (
        <Conversation
          key={sessionId}
          sessionId={sessionId}
          projectId={project.id}
          onTitled={sessions.reload}
        />
      ) : (
        <div className="flex items-center justify-center p-8">
          <EmptyState
            icon={MessagesSquare}
            title="Ask about this codebase"
            action={
              <Button variant="primary" onClick={newChat}>
                Start a chat
              </Button>
            }
          >
            Answers use the files that best match your question, and list them.
          </EmptyState>
        </div>
      )}
    </div>
  );
}

function Conversation({
  sessionId,
  projectId,
  onTitled,
}: {
  sessionId: string;
  projectId: string;
  onTitled: () => void;
}) {
  const history = useApi<{ messages: ChatMessage[] }>(`/chat/sessions/${sessionId}/messages`);
  // Messages sent in this visit are appended to the fetched history (the component is keyed by session).
  const [sent, setSent] = useState<ChatMessage[]>([]);
  const messages = [...(history.data?.messages ?? []), ...sent];
  const [pending, setPending] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [providerId, setProviderId] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [history.data, sent, pending]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    setPending(content);
    setError(null);
    setDraft("");
    try {
      const res = await api<{ userMessage: ChatMessage; assistantMessage: ChatMessage }>(
        `/chat/sessions/${sessionId}/messages`,
        { body: { content, providerId: providerId || undefined } },
      );
      setSent((prev) => [...prev, res.userMessage, res.assistantMessage]);
      if (messages.length === 0) onTitled();
    } catch (err) {
      setError((err as Error).message);
      setDraft(content); // give the question back so it is not lost
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="flex min-h-[60vh] min-w-0 flex-col" aria-label="Conversation">
      <div className="flex-1 overflow-y-auto px-4 py-8" aria-live="polite">
        <div className="mx-auto max-w-2xl space-y-6">
          {history.loading && <Skeleton className="h-16 w-full" />}
          {!history.loading && messages.length === 0 && !pending && <Examples onAsk={send} />}
          {messages.map((m) => (
            <Message key={m.id} message={m} projectId={projectId} />
          ))}
          {pending && (
            <>
              <Message
                message={{
                  id: "pending",
                  role: "USER",
                  content: pending,
                  contextFiles: [],
                  createdAt: "",
                }}
                projectId={projectId}
              />
              <Thinking />
            </>
          )}
          <div ref={end} />
        </div>
      </div>
      <Composer
        draft={draft}
        onDraftChange={setDraft}
        onSend={() => send(draft)}
        busy={pending !== null}
        error={error}
        providerId={providerId}
        onProviderChange={setProviderId}
      />
    </section>
  );
}

function Thinking() {
  return (
    <p role="status" className="flex items-center gap-2.5 text-sm text-ink-3">
      <AssistantMark />
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-pulse rounded-full bg-ink-3"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      Reading the relevant files…
    </p>
  );
}

function AssistantMark() {
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-control bg-marker font-mono text-[11px] font-semibold text-ink"
    >
      m
    </span>
  );
}

function Examples({ onAsk }: { onAsk: (question: string) => void }) {
  return (
    <div className="pt-6 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-panel border border-rule bg-sheet text-ink-2 shadow-panel">
        <MessagesSquare aria-hidden strokeWidth={1.75} className="size-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">Ask about this codebase</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">
        Each answer is based on the files a keyword search ranks as most relevant, and lists them so
        you can check.
      </p>
      <ul className="mt-6 grid gap-2 text-left sm:grid-cols-3">
        {EXAMPLES.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onAsk(q)}
              className="h-full w-full rounded-panel border border-rule bg-sheet p-3 text-left text-sm text-ink-2 shadow-panel transition-[border-color,color] hover:border-ink-3/50 hover:text-ink"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Composer({
  draft,
  onDraftChange,
  onSend,
  busy,
  error,
  providerId,
  onProviderChange,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  error: string | null;
  providerId: string;
  onProviderChange: (id: string) => void;
}) {
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSend();
      }}
      className="px-4 pb-4"
    >
      <div className="mx-auto max-w-2xl space-y-2">
        <ErrorNote>{error}</ErrorNote>
        <div className="rounded-panel border border-rule bg-sheet shadow-pop transition-[border-color] focus-within:border-ink-3">
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={4000}
            placeholder="Ask about the code…"
            aria-label="Question"
            className="block w-full resize-none bg-transparent px-3.5 pt-3 text-sm outline-none placeholder:text-ink-3"
          />
          <div className="flex items-center gap-2 px-2 pb-2">
            <ProviderSelect value={providerId} onChange={onProviderChange} compact />
            <span className="ml-auto hidden text-xs text-ink-3 sm:inline">
              <kbd>↵</kbd> send · <kbd>⇧</kbd> <kbd>↵</kbd> new line
            </span>
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="Send"
              className="flex size-8 items-center justify-center rounded-control bg-ink text-sheet transition-opacity hover:bg-ink/85 disabled:opacity-30"
            >
              <ArrowUp aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Message({ message, projectId }: { message: ChatMessage; projectId: string }) {
  if (message.role === "USER") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="flex justify-end"
      >
        <p className="max-w-[85%] rounded-panel rounded-br-[3px] bg-ink px-3.5 py-2 text-sm whitespace-pre-wrap text-sheet">
          {message.content}
        </p>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3"
    >
      <AssistantMark />
      <div className="min-w-0 flex-1">
        {/* react-markdown does not render raw HTML, so model output cannot inject markup. */}
        <div className="prose-answer text-sm">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {message.contextFiles.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs text-ink-3">
              <FileCode2 aria-hidden className="size-3.5" />
              Based on {message.contextFiles.length} files
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {message.contextFiles.map((p) => (
                <li key={p}>
                  <Link
                    href={`/projects/${projectId}/code?file=${encodeURIComponent(p)}`}
                    className="flex items-center gap-1.5 rounded-control border border-rule bg-sheet px-2 py-1 font-mono text-xs text-ink-2 shadow-panel hover:border-ink-3/50 hover:text-ink"
                  >
                    <FileIcon name={p} className="text-ink-3" />
                    {p}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
}
