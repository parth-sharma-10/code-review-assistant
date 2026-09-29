# API reference

Base URL: `http://localhost:4000` directly, or `http://localhost:3000/api` through the frontend (same
routes with an `/api` prefix; this is what the browser uses).

**Authentication.** Every route requires the `access_token` cookie, which login and register set,
except `POST /auth/register`, `POST /auth/login` and `POST /auth/logout`. A missing or invalid cookie
gives `401`.

**Authorization.** Resources belonging to another user return `404`, exactly like missing ones.

**Validation.** Bodies are validated against DTOs. Unknown properties are rejected
(`property x should not exist`). Path IDs must be UUIDs, else `400 Validation failed (uuid is
expected)`.

**Errors** always have this shape:

```json
{ "statusCode": 400, "message": "A FILE review needs exactly one fileId", "error": "Bad Request" }
```

`message` is an array for DTO validation errors. AI failures use `"error": "AI Provider Error"`.

| Status | Meaning |
|---|---|
| 400 | Invalid input, invalid ZIP, no provider configured |
| 401 | Not signed in / invalid session / wrong credentials |
| 404 | Not found **or not yours** |
| 409 | Duplicate email or provider name |
| 413 | Upload larger than 20 MB |
| 429 | Rate limit: 120 req/min per user by default; 10/min for login/register (per email) and for AI routes (per user) |
| 502 | AI provider unreachable, returned an error, or produced invalid output twice |
| 504 | AI provider timed out |

---

## Auth

### `POST /auth/register`
```json
{ "email": "ada@example.com", "password": "at-least-8-chars" }
```
`201` → `{ "id": "uuid", "email": "ada@example.com" }` plus a `Set-Cookie: access_token=…; HttpOnly;
SameSite=Lax; Max-Age=86400` (`Secure` in production). The email is trimmed and lower-cased. The
password must be 8–128 characters. Errors: `400` validation, `409` "An account with this email already
exists".

### `POST /auth/login`
Same body. `200` → `{ id, email }` plus the cookie. `401` "Invalid email or password", identical for an
unknown email and a wrong password.

### `POST /auth/logout`
`204`, clears the cookie.

### `GET /auth/me`
`200` → `{ id, email }`.

---

## Projects

### `GET /projects`
`200` → the user's projects, newest first:
```json
[{ "id": "uuid", "name": "demo-api", "description": null, "createdAt": "…", "updatedAt": "…",
   "_count": { "files": 8, "reviews": 3 } }]
```

### `POST /projects`
`{ "name": "demo-api", "description": "optional" }`. The name is 1–100 characters after trimming; the
description is up to 1000. `201` → a project as above.

### `GET /projects/:id`
`200` → a project. `404` if missing or not yours.

### `DELETE /projects/:id`
`204`. Cascades to files, reviews, chat sessions and messages.

---

## Files

### `POST /projects/:id/upload`
`multipart/form-data` with one field, `file`, holding a `.zip` of at most 20 MB. It **replaces** the
project's current files.

`201`:
```json
{ "storedFiles": 8, "totalBytes": 1767, "skippedCount": 8,
  "skipped": [{ "path": ".env", "reason": "secret" }, { "path": "logo.png", "reason": "binary" }] }
```
Skip reasons: `ignored-directory`, `secret`, `binary`, `too-large` (>512 KB), `symlink`. At most 200
skipped entries are listed.

Errors (`400`): not a ZIP (checked by magic bytes); corrupt archive; unsafe path (`..`, absolute, drive
letter, control characters); more than 20,000 entries; more than 2,000 source files; more than 50 MB of
source after extraction; an entry larger than its header declares (zip bomb); no readable source files.
`413` if the upload is over 20 MB.

### `GET /projects/:id/files?q=`
`200` → metadata only, sorted by path: `[{ id, path, name, extension, size }]`. The optional `q` (≤200
chars) keeps only files whose path **or content** contains it, case-insensitively.

### `GET /projects/:id/files/:fileId`
`200` → `{ id, path, name, extension, mimeType, size, content, createdAt }`.

---

## AI providers

### `GET /ai/providers`
```json
{ "providers": [{ "id": "uuid", "name": "Ollama", "type": "OLLAMA", "baseUrl": "http://localhost:11434/v1",
                  "model": "qwen2.5-coder:7b", "isDefault": true, "hasApiKey": false,
                  "createdAt": "…", "updatedAt": "…" }],
  "environmentFallback": null }
```
The API key is **never** returned; `hasApiKey` says whether one is stored. `environmentFallback` is
`{ "model": "…" }` when the server has an `OPENAI_*` fallback configured.

### `POST /ai/providers`
```json
{ "name": "OpenAI", "type": "OPENAI", "baseUrl": "https://api.openai.com/v1",
  "model": "gpt-4o-mini", "apiKey": "sk-…", "isDefault": false }
```
`type` is one of `OPENAI | LM_STUDIO | OLLAMA | OPENROUTER | CUSTOM`. It only labels the provider; all
types use the same client. `baseUrl` must be `http(s)`; `localhost` and IPs are allowed, and a trailing
`/` is removed. `apiKey` is optional. The first provider becomes the default. `201` → provider view.
`409` on a duplicate name.

### `PATCH /ai/providers/:id`
Any subset of the create fields. `apiKey`: omit to keep the stored key, `""` to remove it, any other
value to replace it. Setting `isDefault: true` clears the previous default.

### `DELETE /ai/providers/:id`
`204`. If it was the default, the newest remaining provider becomes the default.

### `POST /ai/providers/:id/test`
Sends "Reply with the single word: OK". `200` → `{ "ok": true, "latencyMs": 3828, "reply": "OK" }`.
`502`/`504` with the provider's error otherwise.

---

## Reviews

### `POST /projects/:id/reviews`
```json
{ "type": "SECURITY", "scope": "FILES", "fileIds": ["uuid", "uuid"], "providerId": "optional uuid" }
```
- `type`: `SECURITY | PERFORMANCE | QUALITY`.
- `scope`: `FILE` (exactly 1 `fileId`), `FILES` (1–50 `fileIds`), or `PROJECT` (no `fileIds`; the most
  relevant files for the review type are picked within a 60,000-character budget).
- `providerId`: omit to use the default provider.

`201` → a review:
```json
{
  "id": "uuid", "type": "SECURITY", "scope": "FILE", "filePaths": ["src/auth.js"],
  "summary": "The src/auth.js file contains a hardcoded secret and SQL injection vulnerabilities.",
  "criticalCount": 2, "highCount": 0, "mediumCount": 0, "lowCount": 0,
  "providerName": "Ollama", "model": "qwen2.5-coder:7b", "createdAt": "…",
  "project": { "id": "uuid", "name": "demo-api" },
  "result": {
    "summary": "…",
    "issues": [{ "title": "SQL injection", "description": "…", "severity": "CRITICAL",
                 "file": "src/auth.js", "line": 7, "recommendation": "Use parameterised queries…" }],
    "recommendations": ["…"],
    "meta": { "promptVersion": "review-v2", "reviewedFiles": ["src/auth.js"], "omittedFiles": [],
              "truncatedFiles": [], "discardedIssues": 0 }
  }
}
```
`line` is `null` when the model could not point to a line, or cited a line past the end of the file.
Issues citing files the model was not given are removed and counted in `discardedIssues`.

Errors: `400` scope/fileIds mismatch or no provider configured; `404` a `fileId` is not in this project;
`502` invalid model output after one corrective retry (nothing is stored); `502`/`504` provider failure.

### `GET /projects/:id/reviews` and `GET /reviews`
The project's reviews, or all of the user's reviews across projects.

Query: `page` (≥1, default 1), `pageSize` (1–50, default 10), `type` (`SECURITY | PERFORMANCE |
QUALITY | DIFF | ARCHITECTURE`), and `q` (≤200 chars; matches summary, finding titles and file paths,
case-insensitive).

`200` → `{ "items": [review without result], "total": 23, "page": 1, "pageSize": 10 }`.

### `GET /reviews/:id`
`200` → the full review including `result`.

### `POST /projects/:id/diff-review`
```json
{ "baseFileId": "uuid", "compareFileId": "uuid" }
{ "baseFileId": "uuid", "compareContent": "edited source text (≤512 KB)" }
```
Send exactly one of `compareFileId` or `compareContent`, plus an optional `providerId`. `201` → a
review with `type: "DIFF"`, `scope: "FILES"` and:
```json
"result": { "summary": "…", "risk": "MEDIUM",
            "issues": [{ "title": "…", "description": "…", "severity": "CRITICAL", "category": "SECURITY",
                         "line": 8, "recommendation": "…" }],
            "recommendations": [], "meta": { "promptVersion": "diff-v1", "linesAdded": 2, "linesRemoved": 3,
                                              "diffTruncated": false } }
```
`category` is one of `BUG | SECURITY | PERFORMANCE | RISK | QUALITY`, and `line` refers to the new
version. `400` if the two versions are identical or both or neither compare field is given.

### `POST /projects/:id/architecture-analysis`
`{ "providerId": "optional" }`. `201` → a review with `type: "ARCHITECTURE"`, `scope: "PROJECT"`,
`summary` = the overview, severity counts taken from the concerns, and:
```json
"result": { "overview": "…", "components": [{ "name": "Database", "path": "src/db.js", "responsibility": "…" }],
            "dataFlow": "…", "dependencies": [{ "name": "express", "purpose": "HTTP" }],
            "concerns": [{ "title": "…", "description": "…", "severity": "HIGH" }],
            "recommendations": [], "meta": { "promptVersion": "architecture-v1", "keyFiles": ["package.json", "…"] } }
```
A component `path` that does not exist in the project is set to `null`.

---

## Chat

### `POST /projects/:id/chat/sessions`
`201` → `{ "id": "uuid", "title": "New chat", "createdAt": "…" }`.

### `GET /projects/:id/chat/sessions`
`200` → up to 50 sessions, newest first.

### `GET /chat/sessions/:id/messages`
`200` → `{ "id", "title", "projectId", "messages": [{ "id", "role": "USER" | "ASSISTANT", "content",
"contextFiles": ["src/db.js"], "createdAt" }] }`.

### `POST /chat/sessions/:id/messages`
`{ "content": "Which file handles database connections?", "providerId": "optional" }`. The content is
1–4000 characters after trimming.

`201` → `{ "userMessage": {…}, "assistantMessage": { "role": "ASSISTANT", "content": "markdown…",
"contextFiles": ["src/db.js", "src/server.js"] } }`. Both messages are stored only if the model
answered. The first message sets the session title.
