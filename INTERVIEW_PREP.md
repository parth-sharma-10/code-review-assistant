# Interview preparation

A guide to understanding and defending this codebase. Every answer references the actual code, and
where the honest answer is "that is a limitation", it says so. Read the files as you go; do not memorise
the answers.

## Part 1: the 5-minute walkthrough

> "It is a modular monolith. The browser only talks to Next.js, which proxies `/api` to a NestJS API
> backed by Postgres through Prisma. A user uploads a ZIP. The backend parses it in memory with yauzl,
> rejects unsafe paths and oversized content, skips secrets, binaries and dependency folders, and stores
> each text file as a row. The explorer lists metadata and fetches one file at a time.
>
> For a review, the user picks a mode and a scope. The backend loads those files (or, for the whole
> project, ranks files by mode-specific keywords in SQL and fits them to a character budget), formats
> them as line-numbered blocks inside random delimiters marked as untrusted, and calls the user's
> provider through one OpenAI-compatible client. The response is parsed and validated with Zod,
> retried once with the errors fed back, and grounded: findings citing files the model wasn't given are
> dropped. The result is stored with denormalised severity counts, so history is cheap to list.
>
> Chat uses the same retrieval with the question's keywords. Every query is scoped by the signed-in
> user, and the session is an httpOnly JWT cookie."

## Part 2: code map, in reading order

| Step | File | What to understand |
|---|---|---|
| 1 | `backend/src/main.ts`, `app.setup.ts`, `app.module.ts`, `config.ts` | Startup; env validation; global pipes; guard order (auth, then throttle) |
| 2 | `backend/src/auth/*` | Cookie options, argon2, dummy hash, global guard + `@Public()` |
| 3 | `backend/src/projects/projects.service.ts` | `getOwned`: the IDOR defence everything else uses |
| 4 | `backend/src/files/ingest-policy.ts`, `zip-extractor.ts` | Path safety, limits, skip reasons, root stripping |
| 5 | `backend/src/ai/chat-model.ts` | The whole provider abstraction (≈100 lines) |
| 6 | `backend/src/ai/prompts/*`, `schemas.ts`, `structured-output.ts` | Prompt rules, output contract, retry |
| 7 | `backend/src/ai/ai.service.ts`, `context.ts` | Budgeted context, grounding, the four operations |
| 8 | `backend/src/files/retrieval.service.ts` | SQL scoring, budget selection, fallback |
| 9 | `backend/src/reviews/reviews.service.ts`, `chat/chat.service.ts` | Orchestration and persistence |
| 10 | `backend/test/app.e2e-spec.ts` | What is actually proven |
| 11 | `frontend/next.config.ts`, `src/proxy.ts`, `src/lib/api.ts` | The proxy, the route guard, 401 handling |
| 12 | `frontend/src/app/(app)/projects/[id]/code/page.tsx`, `components/code-viewer.tsx` | URL state; findings pinned under lines |

## Part 3: questions and answers

### Architecture and technology choices

**1. Walk me through what happens when I click "Run review".**
`ReviewRunner` posts `{type, scope, fileIds?, providerId?}` to `/api/projects/:id/reviews`. Next
rewrites it to Nest. `JwtAuthGuard` sets `req.user`, the throttler counts it against the 10/min AI
limit, and `ValidationPipe` validates `CreateReviewDto`. Then `ReviewsService.create`:

1. `getOwned` checks the project belongs to the user.
2. `providers.resolve` builds a `ChatModel`.
3. `selectFiles` loads the chosen files (or ranks the project).
4. `ai.generateReview` builds the context and prompt, calls the model, validates, retries if needed,
   and grounds.
5. `save` inserts the review with its counts.

The UI then navigates to the detail page.

**2. Why a modular monolith and not microservices?**
One developer, three days, one deployment. The module boundaries (`auth`, `files`, `ai`, `reviews`,
`chat`) give the separation without network hops, distributed transactions or extra deployments. If
AI work needed to scale independently, the `ai` + `reviews` path is the natural first extraction,
behind a job queue.

**3. Why NestJS?**
The brief required it, and it fits: modules and dependency injection make the ownership service
injectable everywhere, and global guards, pipes and filters give "secure by default" wiring in
`app.module.ts`. DTO validation via class-validator plugs into the global `ValidationPipe`. What I
would watch: decorator-heavy code hides control flow, which is why guard order is commented.

**4. Why PostgreSQL instead of MongoDB?**
The data is relational and ownership matters: users → projects → files/reviews/chats. Postgres gives
foreign keys with `ON DELETE CASCADE` (deleting a project is one statement), unique constraints
(`(projectId, path)`, `(userId, name)`), transactions (a re-upload deletes and inserts atomically), and
still has `jsonb` for the variable review result. With Mongo, cascades and ownership become application
code.

**5. Why does the browser call `/api` on Next.js instead of the API directly?**
Same origin. The session cookie is first-party, `SameSite` works without cross-site exceptions, and
there are no CORS preflights. The cost is two defaults to override: the 30 s proxy timeout
(`proxyTimeout`) and the 10 MB body buffering limit (`proxyClientMaxBodySize`, plus `proxy.ts`
returning 413). We found the second by uploading a 12 MB ZIP: it hung.

**6. Why are all pages client components?**
Every page needs authenticated data. Server components would have to read the cookie and forward it to
the backend on every render. For an authenticated tool with no SEO, client-side fetching through one
`api()` helper is simpler and consistent. The tradeoff is a loading state on first paint.

**7. Why no `users` module when the brief listed one?**
Nothing but `auth` touches users. An empty module would be a layer with no job. If profile management
arrived, it would get one.

### Authentication

**8. How does login work?**
`AuthService.login` lower-cases the email (a DTO transform) and finds the user. It verifies with
`argon2.verify` against the stored hash, or against a dummy hash if the user doesn't exist. On success
the controller sets `access_token` (HS256 JWT `{sub, email}`, 24 h) with `HttpOnly; SameSite=Lax;
Path=/` (`Secure` in production).

**9. Why httpOnly cookies instead of localStorage?**
Script cannot read an httpOnly cookie, so an XSS bug cannot steal the session. OWASP's session cheat
sheet says not to keep tokens in `localStorage`. Our risk of XSS is not zero: we render model output
and uploaded code, although both are rendered as text.

**10. Doesn't a cookie make you vulnerable to CSRF?**
`SameSite=Lax` means the browser does not attach the cookie to cross-site POST, PATCH or DELETE, and we
have no state-changing GETs. So a malicious site cannot make authenticated mutations. CORS is also
locked to `FRONTEND_URL`. Why Lax and not Strict: `proxy.ts` checks the cookie on top-level
navigation, and Strict would drop it when arriving from a link on another site.

**11. How do you log out a stolen token?**
You can't, and that is a documented limitation. Logout clears the cookie in this browser, but the JWT
remains valid until expiry. The fix: a `tokenVersion` integer on `users`, put into the token and
compared in `JwtAuthGuard`. Incrementing it revokes every session, at one indexed read per request.

**12. Why the dummy hash on unknown emails?**
Without it, "no such user" returns immediately while "wrong password" spends time in Argon2 (measured
at ~25 ms per verify on the development laptop, an Apple Silicon Mac), and that timing difference
reveals which emails exist. Both paths now do one verify and return the same
message. Registration still reveals existence with a 409; that is an accepted usability tradeoff.

**13. What happens if someone forges `alg: none`?**
`JwtModule` verifies with `algorithms: ['HS256']`, so an unsigned token fails. The test "rejects forged
tokens" sends one and expects 401.

### Authorization

**14. How do you prevent IDOR?**
Every query filters by the authenticated user. Projects use
`findFirst({ where: { id, userId } })` in `ProjectsService.getOwned`, and every service that touches a
project's children calls it first. Reviews, chat sessions and providers carry `userId` and filter on
it. A single file is fetched with `where: { id, projectId, project: { userId } }`. There's also a
subtle one: in a review request, `fileIds` are matched with `where: { projectId, id: { in } }`, so a
user can't review another user's file by passing its ID with their own project. The integration test
walks 14 routes as a second user and expects 404 on every one.

**15. Why 404 instead of 403?**
A 403 confirms the resource exists. With 404, another user's project is indistinguishable from a
non-existent one, so IDs can't be probed. The UUID primary keys make guessing impractical anyway.

**16. What if a new endpoint forgets the check?**
Authentication can't be forgotten: the guard is global, and opting out needs an explicit `@Public()`.
Authorization *can* be forgotten; that's the honest answer. Mitigations: the pattern is one call
(`getOwned`), and the IDOR test is the place to add every new route. A stronger design is Postgres
row-level security with the user ID set per transaction, which enforces it in the database.

### File ingestion and ZIP security

**17. Walk me through the upload.**
Multer buffers one file (≤20 MB, no other fields). The controller checks the ZIP magic bytes. The
service calls `getOwned`, then `extractZip`. Entries are read lazily. For each one: a
directory → skip; `safeEntryPath` → reject the archive if unsafe; symlink → skip; `classify`
(ignored dir, secret, binary extension, >512 KB) → skip with a reason; add to the running total
(≤50 MB) and file count (≤2,000) → reject if over; inflate; decode as UTF-8 (NUL or invalid → binary
skip). Then the shared root folder is stripped, and one transaction replaces the project's files.

**18. How exactly does your Zip Slip protection work?**
Two layers. First, yauzl validates names and errors on `/abs`, `C:`, `..` segments and backslashes.
Second, independently, `safeEntryPath`:

1. Rejects empty or >1024-character names and control characters.
2. Converts `\` to `/` and rejects leading `/` or drive letters.
3. `path.posix.resolve('/__upload_root__', name)` and requires that the result starts with
   `/__upload_root__/`.
4. Returns the relative remainder.

Anything that escapes the root rejects the whole archive. Most importantly, nothing is written to disk
at all, so there is no destination to escape. The unit tests feed it `../`, `..\\`, absolute, drive,
NUL and newline cases. `makeZipWithRawName` builds real malicious archives by byte-patching a
placeholder name, because zip libraries refuse to write them.

**19. How do you handle zip bombs?**
Two ideas. First, check *declared* sizes before inflating: skip files over 512 KB, and reject if the
running total passes 50 MB or the entry count passes 20,000. Second, don't trust the declaration:
yauzl's `validateEntrySizes` counts real bytes while inflating and errors if they exceed the header. The
test builds a 5 MB entry, patches its declared size to 100 bytes, and expects rejection. Mutation
check: turning `validateEntrySizes` off makes that test fail.

**20. Why store code in Postgres rather than on disk or S3?**
At ≤50 MB and ≤2,000 files per project: one store, transactional replace, and retrieval that runs in
SQL. Postgres TOAST compresses values over ~2 kB out of line, so list queries that select only
metadata don't read content. At a larger scale: metadata in Postgres, blobs in object storage.

**21. What stops a user uploading their `.env`?**
`classify` skips `.env*` (keeping `.env.example/.sample/.template`), key and certificate extensions,
`id_rsa*`, `.npmrc`, `.netrc`, `.pgpass`, `credentials.json`, service-account JSON and `*.tfstate`. The
upload result lists every skipped file and why. The integration test asserts the `.env` content never
reaches the database. The limitation: a secret in `config.json` is not detected.

**22. Could uploaded code ever execute?**
No code path runs, imports, builds or shells out on uploaded data. It is text in a column, rendered as
text in the browser, and sent as text to the model.

### AI provider and prompts

**23. Why is your provider abstraction designed this way?**
Everything the app needs from a vendor is `complete(messages) → string`: that is the `ChatModel`
interface. OpenAI, LM Studio, Ollama and OpenRouter all implement `POST /chat/completions`, so one
class, `OpenAICompatibleChatModel`, serves them all. Subclasses would be identical code. The
provider-agnostic logic (prompts, validation, grounding) is in `AiService`, which only sees
`ChatModel`. Adding Anthropic's native API would be one new class implementing the interface.

**24. Why not the OpenAI SDK?**
It's a dependency for one HTTP call, and its defaults target OpenAI. `fetch` with a timeout, redirect
refusal and error classification fits in one ~110-line file (`chat-model.ts`, including the
interface and error types) that I can read end to end. A new client per request is
free: Node's global undici agent pools connections per origin.

**25. Why don't you set `temperature: 0` or use JSON mode?**
Portability. Newer OpenAI reasoning models reject a non-default temperature. LM Studio's structured
output supports `json_schema` but not `json_object`. Either parameter would break at least one
supported provider. So the request is `{model, messages}`, and the structure guarantee comes from our
own validation. The cost: less deterministic output.

**26. How are prompts organised?**
`backend/src/ai/prompts/`: `security-`, `performance-` and `quality-review.prompt.ts` hold a title and
a focus list each; `review.prompt.ts` combines one of them with the shared rules and JSON shape;
`diff-review`, `architecture` and `chat` have their own; `shared.ts` holds the untrusted-input rules,
JSON rules and severity guide. Each exports a version (`review-v2`) that is stored with results. The
v1 → v2 changes came from testing against a real model.

**27. What does the prompt tell the model to prevent invented findings?**
Analyse only the supplied files. Never invent files, findings or line numbers; `file` must be a
supplied path and `line` may be null. Only demonstrated problems go in `issues`; suggestions go in
`recommendations`. Stay in the mode's focus. An empty list is valid. We don't *trust* this: grounding
enforces the file rule, and line numbers are range-checked.

### Structured output and validation

**28. How do you validate AI output?**
`completeStructured`:

1. Pulls JSON out of a fence or from the first `{` to the last `}`.
2. Runs `schema.safeParse`. The schemas in `schemas.ts` cap every string's length and every array's
   size, and lightly normalise case and numeric strings.
3. On failure, logs the validation errors (not the content) and re-asks with the original prompt, the
   bad reply and up to eight errors.
4. After two failures, throws `AiOutputError`, which the filter maps to 502. Nothing is stored.

Then `groundReview` drops issues citing unsupplied files and nulls out-of-range lines.

**29. Why only one retry?**
Latency and cost. A local review takes 5–40 s, and with one retry the worst case is still bounded. In
practice, if a model fails twice it can't do the task, so a third attempt mostly wastes time. The user
gets an actionable message ("use a more capable model").

**30. What if the model returns a valid finding with the wrong line?**
If the line is past the end of the file, it is nulled. If it is in range but wrong, we can't detect
that. Line-numbered context reduces it, because the model copies a number it was shown instead of
counting, and every finding links to the code so a human can check in one click. The honest claim is
that the structure is guaranteed and the judgement is not.

### Retrieval and chat

**31. How does chat pick the code to send?**
`extractTerms` produces up to 12 lower-cased terms (splitting camelCase and dots, dropping stopwords,
adding crude singulars). `RetrievalService.rank` runs one SQL query that scores every file of the
project: 3 × terms in the path + Σ ln(1 + occurrences in content). That excludes lockfiles, minified
files, maps and SVGs. The top 12 are fitted into 30,000 characters using the stored `size`, and only
then are those files' contents loaded. With no matches, it falls back to README, `package.json` and
entry points. The last 6 messages go along as history.

**32. Why didn't you use a vector database?**
The brief said simple retrieval is acceptable, and code questions mostly use literal identifiers
(`auth`, `JwtAuthGuard`, `db`), where keyword matching is strong and explainable. Embeddings would add
an embedding provider to configure, chunking, re-indexing on every upload, and a new failure mode.
Where keyword search is weak is synonyms: "authenticated" won't match a file named `auth.ts`. If that
became the main complaint, I'd add pgvector *inside* the same Postgres.

**33. How would your retrieval work with 100,000 files?**
Badly as written: each question scans all content. In order:

1. A `pg_trgm` GIN index on `content`, so `%term%` lookups become index scans.
2. Chunk files into ~100-line segments and score chunks, so a large file doesn't consume the whole
   budget.
3. Precompute a per-chunk term index at upload time.
4. Add embeddings in pgvector for semantic recall, combined with keyword scores.

Ingestion limits (2,000 files, 50 MB) would also have to move to background processing.

**34. How do you prevent prompt injection from uploaded code?**
Defence in depth, never a guarantee:

1. The system prompt says the code is untrusted data and instructions inside it must be ignored.
2. Files are wrapped in `<<<FILE {boundary} …>>>`, where the boundary is 12 random hex characters per
   request, so a comment can't fake `<<<END FILE>>>` and "escape" the data block.
3. Output must match a strict schema; free text can't take over the response format.
4. Findings are grounded against real files.
5. Most importantly, the model has **no tools or privileges**. It can't read other data, call APIs or
   change anything.

A successful injection can make one review wrong or incomplete, which the user sees and can
cross-check. That is OWASP LLM01's guidance: segregate untrusted content, validate output
deterministically, least privilege.

**35. Why are chat messages saved only after the model answers?**
So a failure (timeout, bad key) leaves no orphan question without an answer. Both rows are written in
one transaction. They get explicit timestamps because inside one transaction they'd share `now()` and
come back in random order. The integration test caught exactly that.

### Reliability

**36. What happens when OpenAI is down?**
`fetch` fails or returns 5xx. The client throws `AiProviderError` (kind `unreachable` or `http`), and
`AiErrorFilter` returns 502 with a message like "AI provider returned HTTP 503: …". Timeouts (180 s)
return 504. No review or chat message is stored, and the chat UI puts the question back in the input
box. There is no automatic failover to another provider: the user can pick another provider per
request from the Model dropdown. Automatic failover and retry with backoff would be next.

**37. What happens if two users upload at the same time?**
Each upload is independent: separate buffers, separate transactions on different projects. Two uploads
to the *same* project serialise at the database; the last transaction wins, and each is internally
consistent (delete + insert atomically). Memory is the limit: each in-flight upload holds up to 20 MB.

**38. Where does this system fall over first under load?**
AI requests. They are synchronous and hold an HTTP connection for up to 180 s, and a local model
processes them one at a time. Next, uploads, because of memory. Then retrieval's full scans. The fix
order: a job queue for AI work (pg-boss keeps it in Postgres), streaming uploads to disk in a worker,
and trigram indexes.

### Database

**39. Explain your schema choices.**
UUID keys; `userId` on everything user-owned, even where it's derivable (reviews, chat sessions), so
ownership checks never need joins; cascade deletes everywhere; `(projectId, path)` unique on files;
composite indexes matching the list queries (`(userId, createdAt desc)`). Reviews store the full
validated `result` as `jsonb`, plus denormalised counts, summary, file paths, model and `searchText`,
so listing and searching history never parses JSON.

**40. Why denormalise severity counts?**
The history list shows counts for every row. Computing them would mean loading and parsing each
`result` blob, which is large, for up to 50 rows per page. Counts are computed once at insert, from
validated data, and never change, so there's no consistency risk.

**41. Why offset pagination?**
Simple, and correct at this scale (hundreds of reviews per user), with a `total` for page counts. At
scale it degrades on deep pages and can shift rows under concurrent inserts. Keyset pagination on
`(createdAt, id)` would replace it.

### Frontend

**42. How does the frontend protect routes?**
`proxy.ts` redirects to `/login` if the `access_token` cookie is absent. That is *only* UX: it doesn't
verify the token. The backend verifies on every call. If the API returns 401, `api()` calls logout to
clear the dead cookie, then redirects. Without clearing it, `proxy.ts` would bounce `/login` straight
back into the app, an infinite loop.

**43. How do findings appear inside the code?**
The explorer's URL is `?file=&line=&review=`. `CodeViewer` renders a table row per line. Findings for
the file are grouped by `line`, and each group renders as an extra row directly after its line. The
cited line gets the highlighter background and is scrolled into view. Findings without a usable line
render above the listing. The frontend test checks that a finding lands in the row after its line.

### Testing and process

**44. What do your tests actually prove?**
The integration suite runs the real Nest HTTP pipeline against a real Postgres test database, with a
fake OpenAI-compatible HTTP server. So the client, the prompts, validation and persistence are all
exercised, not mocked. It proves:

- Cookie attributes and argon2 storage.
- Identical login errors.
- 404s across 14 cross-user routes.
- Zip Slip rejection over HTTP.
- API keys encrypted and never returned.
- Invented-file findings dropped.
- Retry-then-success, and 502 with nothing stored.
- Chat context selection.
- Diff rendering and architecture path grounding.

I also broke three controls on purpose (the `userId` scope, entry-size validation, grounding) and
confirmed a test failed each time. What the suite does *not* prove: behaviour with real OpenAI or LM
Studio, and anything browser-specific. Those were checked manually or not at all (see AI_USAGE.md).

**45. You used AI to build this. What do you actually understand, and what would you do differently?**
*Answer in your own words after reviewing the code.* The honest framing: I specified the product and
constraints, the agent implemented it, and I reviewed and can explain every decision in this file.
Good candidates for "differently":

- Row-level security instead of relying on every service remembering `userId`.
- A job queue for reviews from day one.
- Provider-native structured output where available.
- Token revocation.

## Part 4: what I would change with two more weeks

1. **Background jobs** for reviews and architecture analysis (pg-boss), with progress, cancellation
   and retries, so no request holds a connection for minutes.
2. **Session revocation and refresh tokens** (`tokenVersion`, short-lived access tokens).
3. **Postgres row-level security** as a second, database-enforced layer of tenant isolation.
4. **SSRF controls** for provider URLs in multi-tenant mode (resolve DNS, deny private ranges, or an
   allowlist).
5. **Retrieval v2:** `pg_trgm` index, chunk-level scoring, optional pgvector.
6. **Upload versions,** so diff review can compare two uploads of the same file.
7. **Provider capabilities:** use `json_schema` output and streaming where a provider supports them.
8. **Playwright end-to-end tests in CI,** plus a GitHub Actions pipeline (lint, test, build).
9. **Observability:** structured logs with request IDs, and AI latency and retry metrics.

## Part 5: numbers to know

| Thing | Value | Where |
|---|---|---|
| Upload size | 20 MB compressed | `files/ingest-policy.ts` `LIMITS` |
| Per file / total | 512 KB / 50 MB uncompressed | same |
| Entries / stored files | 20,000 / 2,000 | same |
| Review / chat / diff budget | 60k / 30k / 40k characters | `ai/ai.service.ts` `BUDGETS` |
| Architecture | tree 12k + key files 30k chars, ≤25 key files | `BUDGETS`, `reviews.service.ts` |
| Files per FILES review | 50 | `reviews.dto.ts` |
| Chat history sent | 6 messages × ≤2,000 chars | `chat.service.ts` |
| AI timeout | 180 s (`AI_TIMEOUT_MS`) | `config.ts` |
| Rate limits | 120/min default; 10/min auth (per email) and AI (per user) | `common/rate-limits.ts` |
| Session | 24 h, HS256 | `auth/auth.cookie.ts`, `auth.module.ts` |
| Argon2id | 64 MiB, t=3, p=4 (library defaults) | node-argon2 |
| Tests | 98 backend, 11 frontend | `npm test` |
