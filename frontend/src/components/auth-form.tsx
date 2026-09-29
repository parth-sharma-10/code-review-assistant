"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { CodeViewer } from "./code-viewer";
import type { Note } from "./finding-note";
import { Button, ErrorNote, Field, TextInput } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api(`/auth/${mode}`, {
        body: { email: form.get("email"), password: form.get("password") },
      });
      const next = params.get("next");
      // Only same-app paths: an attacker-supplied ?next=https://evil.example must not redirect.
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <p className="flex items-center gap-2 font-mono text-[15px]">
          <span className="rounded-[3px] bg-marker px-1.5 py-px font-semibold">margin</span>
          <span className="font-sans text-xs text-ink-3">code review</span>
        </p>
        <div className="my-auto w-full max-w-sm animate-fade-in py-12">
          <h1 className="text-[26px] font-semibold tracking-tight">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-ink-2">
            {isLogin
              ? "Sign in to read your reviews and their findings."
              : "Upload a repository and run your first review in a few minutes."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              <TextInput
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                autoFocus
              />
            </Field>
            <Field label="Password" hint={isLogin ? undefined : "At least 8 characters."}>
              <TextInput
                name="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                minLength={isLogin ? 1 : 8}
                maxLength={128}
              />
            </Field>
            <ErrorNote>{error}</ErrorNote>
            <Button type="submit" variant="primary" busy={busy} className="h-9 w-full">
              {isLogin ? "Sign in" : "Create account"}
              {!busy && <ArrowRight aria-hidden />}
            </Button>
          </form>

          <p className="mt-6 text-sm text-ink-2">
            {isLogin ? "No account yet? " : "Already registered? "}
            <Link
              href={isLogin ? "/register" : "/login"}
              className="font-medium text-ink underline decoration-marker-edge decoration-2 underline-offset-4 hover:bg-marker"
            >
              {isLogin ? "Create one" : "Sign in"}
            </Link>
          </p>
        </div>
      </div>
      <Preview />
    </main>
  );
}

const SAMPLE = `const jwt = require('jsonwebtoken');
const db = require('./db');

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM users WHERE email = '" + email + "'";
  const r = await db.query(sql);
  if (!r.rows.length) return res.status(401).send('bad');
  res.json({ token: jwt.sign({ id: r.rows[0].id }, SECRET) });
};`;

const SAMPLE_FINDING: Note = {
  title: "SQL injection in login query",
  description:
    "`email` from the request body is concatenated into the SQL string, so a crafted address can rewrite the query.",
  severity: "CRITICAL",
  file: "src/auth.js",
  line: 6,
  recommendation: "Use a parameterised query: `db.query('... WHERE email = $1', [email])`.",
};

/**
 * What the product does, shown with the product: the real listing component rendering a sample
 * finding under the line it cites. Decorative for assistive tech; the form is the page.
 */
function Preview() {
  return (
    <aside
      aria-hidden
      className="relative hidden overflow-hidden border-l border-rule bg-rail lg:flex lg:flex-col lg:justify-center lg:px-12"
    >
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-sm font-medium text-ink-2">Findings land on the line they cite.</p>
        <p className="mt-1 max-w-md text-sm text-ink-3">
          Security, performance and quality reviews, diff reviews and code-aware chat, on any
          OpenAI-compatible model, including a local one.
        </p>
        <div className="pointer-events-none mt-6 animate-pop-in overflow-hidden rounded-panel border border-rule bg-sheet shadow-pop select-none">
          <div className="flex h-10 items-center gap-2 border-b border-rule bg-paper px-4 font-mono text-[13px] font-semibold">
            <span className="size-2 rounded-[2px] bg-critical-mark" />
            src/auth.js
          </div>
          <div className="@container overflow-hidden">
            <CodeViewer path="auth.js" content={SAMPLE} annotations={[SAMPLE_FINDING]} />
          </div>
        </div>
      </div>
    </aside>
  );
}
