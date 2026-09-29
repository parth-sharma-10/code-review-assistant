# Decision: PostgreSQL + Prisma, with source text stored in the database

## Problem

The app stores users, projects, uploaded source files (up to 2,000 per project), reviews with a
variable JSON result, provider settings and chat history. It needs strict per-user isolation, cascading
deletes, pagination, text search and a schema that can evolve.

## Alternatives

| Option | For | Against |
|---|---|---|
| **PostgreSQL** | Relational integrity (FKs, cascades, unique constraints), `jsonb` for flexible review results, arrays, full-text and trigram search, transactions | Needs a server (Docker) |
| MongoDB | Flexible documents | Ownership and cascades become application code; no FK guarantees; the brief specifies PostgreSQL |
| SQLite | Zero setup | Weaker concurrency and search options; the brief specifies PostgreSQL |
| Files on disk / S3 for source | Cheap for large blobs | Two stores to keep consistent; replace-on-upload needs coordination; retrieval can't run in SQL |

ORM choice: Prisma (as specified), which gives typed queries, parameterised SQL and migration files.
Prisma 6.19 was pinned because npm's `latest` tag pointed at an 8.0 release candidate when the project
was set up (2026-09-29).

## Evidence

- PostgreSQL TOAST: "The TOAST management code is triggered only when a row value to be stored in a
  table is wider than `TOAST_TUPLE_THRESHOLD` bytes (normally 2 kB)", compressing and/or moving values
  out of line. The maximum value size is 1 GB. https://www.postgresql.org/docs/current/storage-toast.html
  Large `content` values therefore don't bloat the main heap, and list queries that `select` only
  metadata columns don't read them.
- Upload limits cap a project at 50 MB of text across ≤2,000 files, well inside what one Postgres table
  handles comfortably.

## Decision

- **Source code is a `text` column on `files`,** with `@@unique([projectId, path])`. Re-upload is one
  transaction: `deleteMany` + `createMany` + touching the project. There is no moment where half the
  files are new.
- **Reviews:** a `jsonb` `result` (its shape depends on type and is validated by Zod before insert),
  plus denormalised columns for everything a list needs: type, scope, summary, four severity counts,
  file paths, provider and model, and a lower-cased `searchText`. History pages never read `result`.
- **Isolation:** `userId` on projects, providers, reviews and chat sessions. Every query filters on it.
  UUID primary keys.
- **Cascades:** all foreign keys use `ON DELETE CASCADE`, so deleting a project or user removes
  dependents in one statement.
- **Indexes match the access paths:** `(userId, createdAt desc)` on projects and reviews,
  `(projectId, createdAt desc)` on reviews and sessions, `(sessionId, createdAt)` on messages, and
  unique `(userId, name)` on providers.
- **Pagination:** offset (`skip`/`take`) with a total count, capped at 50 per page.

## Tradeoffs

- **Offset pagination** gets slower on deep pages and can skip or duplicate rows if data changes
  between pages. That is irrelevant at hundreds of reviews per user; keyset pagination on
  `(createdAt, id)` would replace it at scale.
- **`searchText ILIKE '%q%'`** is a sequential scan per user. A `pg_trgm` GIN index is the next step.
- **Code in the database** makes backups larger and would not suit multi-gigabyte monorepos. Metadata
  in Postgres with blobs in object storage is the production shape.
