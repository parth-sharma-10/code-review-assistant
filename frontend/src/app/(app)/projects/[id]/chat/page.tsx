"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { useProject } from "@/components/project-context";
import { ProviderSelect } from "@/components/provider-select";
import { Button, EmptyState, ErrorNote, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
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
      <main className="mx-auto max-w-5xl px-4 py-8">
        <EmptyState title="Nothing to chat about yet">
          <Link
            href={`/projects/${project.id}`}
            className="font-medium text-ink underline underline-offset-2"
          >
            Upload source code
          </Link>{" "}
          first.
        </EmptyState>
      </main>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:h-full lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-rule bg-sheet p-3 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <Button onClick={newChat} className="mb-3 w-full">
          New chat
        </Button>
        {sessions.loading && <Loading />}
        <ul className="space-y-0.5">
          {sessions.data?.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setActiveId(s.id)}
                aria-current={s.id === sessionId ? "true" : undefined}
                className="w-full rounded-[4px] px-2 py-1.5 text-left text-sm text-ink-2 hover:bg-wash aria-[current=true]:bg-wash aria-[current=true]:text-ink"
              >
                <span className="block truncate">{s.title}</span>
                <span className="block text-xs text-ink-3">{formatDate(s.createdAt)}</span>
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
          <EmptyState title="Ask about this codebase">
            Answers use the files that best match your question.{" "}
            <button onClick={newChat} className="font-medium text-ink underline underline-offset-2">
              Start a chat
            </button>
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
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6" aria-live="polite">
        {history.loading && <Loading label="Loading conversation" />}
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
            <p className="mx-auto max-w-2xl text-sm text-ink-3" role="status">
              Reading the relevant files…
            </p>
          </>
        )}
        <div ref={end} />
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

function Examples({ onAsk }: { onAsk: (question: string) => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-ink-2">
        Ask a question about the uploaded code. Each answer is based on the files a keyword search
        ranks as most relevant, listed under the answer.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((q) => (
          <li key={q}>
            <Button onClick={() => onAsk(q)}>{q}</Button>
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
      className="border-t border-rule bg-sheet p-3"
    >
      <div className="mx-auto max-w-2xl space-y-2">
        <ErrorNote>{error}</ErrorNote>
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          maxLength={4000}
          placeholder="Ask about the code. Enter to send, Shift+Enter for a new line."
          aria-label="Question"
          className="w-full resize-y rounded-[4px] border border-rule bg-sheet px-3 py-2 text-sm focus:border-ink focus:outline-none"
        />
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <ProviderSelect value={providerId} onChange={onProviderChange} />
          </div>
          <Button type="submit" variant="primary" busy={busy} disabled={!draft.trim()}>
            Send
          </Button>
        </div>
      </div>
    </form>
  );
}

function Message({ message, projectId }: { message: ChatMessage; projectId: string }) {
  if (message.role === "USER") {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-[6px] bg-ink px-3 py-2 text-sm text-sheet">
          {message.content}
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl">
      {/* react-markdown does not render raw HTML, so model output cannot inject markup. */}
      <div className="prose-answer text-sm">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      {message.contextFiles.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-ink-3">
          <span>Based on:</span>
          {message.contextFiles.map((p) => (
            <Link
              key={p}
              href={`/projects/${projectId}/code?file=${encodeURIComponent(p)}`}
              className="hover:text-ink hover:underline"
            >
              {p}
            </Link>
          ))}
        </p>
      )}
    </div>
  );
}
