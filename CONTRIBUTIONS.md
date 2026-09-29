# Contributions and development process

Read with [AI_USAGE.md](AI_USAGE.md). This file describes *how* the project was built and how the
git history relates to that process.

## Roles

| Who | Contribution |
|---|---|
| Parth Sharma (author) | Product specification and constraints (two written briefs); decisions on repository location, AI-use policy and local-model installation; review of the final code and documents |
| Claude Code (Claude Opus 5.5) | Implementation of all code, tests and documentation; debugging; research lookups; manual testing |

## Process

The work followed the phases in the brief, in this order:

1. **Inspect and plan:** confirm the repository did not exist; choose ports (Postgres on 5433 because
   5432 was taken locally); pin Prisma 6.19 because npm `latest` was an 8.0 release candidate; read the
   bundled Next.js 16 docs, which changed `middleware` → `proxy`.
2. **Backend,** module by module: config validation → Prisma → auth → projects → ZIP ingestion →
   providers and AI client → reviews/diff/architecture → chat. Each was smoke-tested with curl against
   the running server, including malicious archives and cross-user requests.
3. **Backend tests:** unit tests for pure security logic, and an HTTP integration suite with a fake
   OpenAI-compatible server. Three mutation checks confirmed that the key security tests can fail.
4. **Real-model check:** Ollama + `qwen2.5-coder:7b`. This exposed prompt weaknesses that mocks could
   not (off-focus findings, copied line-number prefixes), which led to `review-v2`, `chat-v2` and
   post-processing.
5. **Frontend:** design direction chosen deliberately (a code listing marked up by a reviewer: cool
   paper, ink, a highlighter for lines under review, severity as the only other colour), then pages and
   components.
6. **Browser testing,** which found the Next.js 10 MB body truncation, a layout overflow, a contrast
   problem and a stale counter. All fixed.
7. **Formatting and linting** (Prettier at 100 columns, ESLint with zero findings), then frontend tests.
8. **Git history,** then documentation and research notes.
9. **Audit:** a fresh-clone run of the whole demo, then enforcing the ≤100-line / complexity ≤8
   function limits in ESLint. Splitting the long components exposed a scope-fallback bug and missing
   error handling, both fixed. A phone-width check found and fixed two overflow problems, and a
   computed contrast check raised the tertiary text colour.

## About the git history

The code was written in a single working session and then **split into feature commits** that follow
the dependency order above. It was not committed incrementally as it was typed. Care was taken that
the history is truthful:

- Files that grew across features (`app.module.ts`, `files.module.ts`) were committed in the version
  matching each commit, so every backend commit imports only the modules that exist at that point.
- Each of the seven backend commits was type-checked in isolation (`tsc --noEmit` in a separate git
  worktree), and all passed.
- Frontend commits were not individually built.
- Later commits (fixes found during the audit, documentation) were made as they happened.

## Conventions

- Conventional-commit prefixes (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), imperative mood,
  subject ≤72 characters.
- No secrets committed: `.env` files are ignored, and `.env.example` has empty secret values.
- Commits carry only the author's git identity.
