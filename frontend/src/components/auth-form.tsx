"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="mb-8 font-mono text-sm text-ink-2">
          <span className="bg-marker px-1 text-ink">margin</span> · AI code review
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isLogin ? "Sign in" : "Create an account"}
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          {isLogin
            ? "Review your uploaded projects and their findings."
            : "Upload a repository and run your first review in a few minutes."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate={false}>
          <Field label="Email">
            <TextInput name="email" type="email" autoComplete="email" required maxLength={254} />
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
          <Button type="submit" variant="primary" busy={busy} className="w-full">
            {isLogin ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-ink-2">
          {isLogin ? "No account yet? " : "Already registered? "}
          <Link
            href={isLogin ? "/register" : "/login"}
            className="font-medium text-ink underline underline-offset-2"
          >
            {isLogin ? "Create one" : "Sign in"}
          </Link>
        </p>
      </div>
    </main>
  );
}
