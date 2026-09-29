# Decision: keyword retrieval in SQL under a character budget, no vector database

## Problem

Chat questions ("where is the auth middleware?") and whole-project reviews need relevant code in the
prompt. Sending the entire repository fails in three ways: it exceeds context windows (a local model
may have 8k–32k tokens), it is slow and expensive, and it dilutes the relevant code.

## Alternatives

| Option | For | Against |
|---|---|---|
| Send everything | Simplest | Breaks on any real project; wasteful |
| **Keyword scoring over paths and contents** | No new infrastructure; explainable; good for code, where identifiers are literal | Misses synonyms ("login" vs "authenticate") |
| Embeddings + vector DB (pgvector, Qdrant, ...) | Semantic matches | An embedding model and provider to configure; chunking; re-indexing on upload; another failure mode |
| Code graph / symbol index (tree-sitter) | Precise "where is X defined" | A parser per language; a project of its own |

The brief says simple retrieval is acceptable and asks not to build a vector database without a
compelling reason.

## Evidence

- Code questions are dominated by identifiers: file names, function names, library names. Literal
  matching works well for these. Observed in testing: "How does login work and where is the database
  connection created?" retrieved `src/db.js`, `src/server.js`, `src/auth.js` and `src/v2/auth.js`, and
  the model answered from them.
- PostgreSQL's `pg_trgm` supports indexed `LIKE`/`ILIKE '%term%'` searches ("the search string need not
  be left-anchored"), so there is an index-based upgrade path inside the same database.
  https://www.postgresql.org/docs/current/pgtrgm.html

## Decision

Implemented in `backend/src/files/retrieval.service.ts`:

1. **Terms:** lower-cased words of 3+ characters from the question, with camelCase and dotted names
   split, stopwords (including "file", "code", "function") removed, crude singulars added, and at most
   12 terms.
2. **Scoring in SQL**, so contents never leave Postgres before selection:
   `score = 3 × (#terms appearing in the path) + Σ ln(1 + occurrences of each term in the content)`.
   The path weight favours `auth.service.ts` for "auth". The log damps files that repeat one word.
   Lockfiles, minified bundles, source maps and SVGs are excluded.
3. **Budget:** take the top 12 in score order, keeping a file only if its stored size still fits in the
   budget (chat 30,000 chars; reviews 60,000). Contents are loaded only for chosen files.
4. **Fallback:** if nothing matches ("how does this work?"), send the README, `package.json` and
   typical entry points.
5. **Whole-project reviews reuse the same ranking** with per-mode keyword lists (security: `auth`,
   `password`, `token`, `sql`, `exec`, ...), then fill the remaining budget with other source files. The
   files left out are reported to the user.
6. **Context formatting:** random-boundary delimiters, line numbers, and an explicit
   untrusted-content instruction.
7. Each assistant message stores the files it used, and the UI shows them under the answer.

## Tradeoffs

- **No synonym or stem matching.** "Where are users authenticated?" yields the term `authenticated`,
  which does not match a file named `auth.ts` unless that word appears in its content. Questions that
  use identifiers retrieve better. Embeddings would fix this.
- **Full scan per question.** Fine at the 2,000-file upload limit. At 100k files, add a `pg_trgm` GIN
  index, then chunk files (~100 lines) so ranking and context work on chunks instead of whole files,
  then add pgvector embeddings beside the chunks if keyword recall proves insufficient. All of these
  stay inside Postgres.
- **Whole files, not chunks.** A single large relevant file can use most of the budget. Chunking is the
  first improvement if context quality becomes the bottleneck.
