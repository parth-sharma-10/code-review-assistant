# Evaluator walkthrough (about 10 minutes)

Prerequisites: the app is running as described in [SETUP.md](SETUP.md), and a model is available. The
flow below was run with Ollama `qwen2.5-coder:7b` on an Apple Silicon laptop, where each AI step took
roughly 5 to 40 seconds.

The sample repository is [`docs/demo/demo-api.zip`](docs/demo/demo-api.zip): a small Express + Postgres
API with planted problems, plus files that ingestion should refuse.

| Planted item | Where | Expected outcome |
|---|---|---|
| Hardcoded JWT secret | `src/auth.js:2` | Security finding |
| SQL injection (string concatenation) | `src/auth.js:7`, `src/server.js:8` | Security finding |
| N+1 query in a loop | `src/orders.js:5-6` | Performance finding |
| `algorithm: 'none'` in the "fixed" version | `src/v2/auth.js:8` | Diff review finding |
| `.env` with a database password, `deploy/id_rsa` | archive | Skipped as `possible secret` |
| `node_modules/`, `.git/` | archive | Skipped as dependency/build folder |
| `logo.png`, `data/blob.dat` | archive | Skipped as binary |
| `big.sql` (600 KB) | archive | Skipped as over 512 KB |
| `link-to-passwd` (symlink to `/etc/passwd`) | archive | Skipped as symlink |

## 1. Register

Open http://localhost:3000. You are redirected to **/login**. Choose **Create one**, then register
with any email and a password of 8+ characters. You land on the empty dashboard.

*Try:* registering the same email again shows "An account with this email already exists".

## 2. Create a project

**New project** → name `demo-api` → **Create project**.

## 3. Upload the ZIP

**Upload source (.zip)** → choose `docs/demo/demo-api.zip`. The result reads *Stored 8 files ·
skipped 8*. Expand **Show skipped files** to see each file refused and why. The `demo-api-main/`
wrapper folder is stripped automatically.

## 4. Explore the code

**Code** tab. The tree shows `src/`, `src/v2/`, `README.md`, `package.json` and `.env.example`, with no
`.env`. Open `src/auth.js` to see the highlighted listing. Type `db` in **Filter by file name**, or
search file contents for `jsonwebtoken` and press Enter.

## 5. Configure an AI provider

**AI providers → Add provider → Ollama** (or any preset) → **Add provider** → **Test connection**.
You should see "Connected in Ns". Afterwards the provider shows `no key` or `key saved`, never the key
itself.

## 6. Security review (single file)

Back to the project → **Code** → open `src/auth.js` → **Security** · **This file** → **Run review**.
The review page shows the severity counts and findings for the hardcoded secret and the SQL
injection. Click `src/auth.js:7`: the explorer opens with line 7 highlighted and the finding pinned
beneath it.

## 7. Performance review (selected files)

**Code** → tick the checkboxes next to `src/orders.js` and `src/server.js` (hover a file to reveal its
checkbox) → **Performance** · **Selected files** → **Run review**. Expect the N+1 query in
`src/orders.js`.

## 8. Code quality review (whole project)

**Code** → **Code quality** · **Whole project** → **Run review**. The **Coverage** section lists every
file sent to the model. For large projects it also lists the files left out because they did not fit
the context budget.

## 9. Review history

**Reviews** tab: all reviews, newest first. Filter by type, or search for `injection`. The search
covers summaries, finding titles and file paths. The dashboard also shows the latest five reviews
across projects.

## 10. Chat with the code

**Chat → New chat** → click *Which file handles database connections?* The answer cites `src/db.js`
and lists **Based on:** with the files retrieved for this question. Ask a follow-up such as *Is that
connection pooled?*; earlier turns are sent as history.

## 11. Bonus features

**Diff review:** **Diff review** tab → Version A `src/auth.js`, Version B *Another file* →
`src/v2/auth.js` → **Review changes**. The model reviews only the changed lines and should flag the
`algorithm: 'none'` JWT signing as a security problem introduced by the "fix". Alternatively choose
**Edited text**, click **Start from auth.js** and edit it by hand.

**Architecture analysis:** **Overview** tab → **Analyse architecture**. Expect components
(server/auth/db), data flow, dependencies (`express`, `pg`, `jsonwebtoken`, taken from `package.json`)
and concerns.

## Security spot-checks (optional, from a terminal)

```bash
# Unauthenticated access is rejected
curl -i http://localhost:3000/api/projects                              # 401

# Another user's project is indistinguishable from a missing one:
# sign in as a second user, then open the first user's /projects/<id> URL -> "Project not found"

# A Zip Slip archive is rejected before anything is stored
python3 - <<'PY'
import zipfile; z = zipfile.ZipFile('/tmp/slip.zip', 'w'); z.writestr('../../evil.txt', 'x'); z.close()
PY
# Upload /tmp/slip.zip in the UI -> "Invalid ZIP archive: invalid relative path: ../../evil.txt"
```

Model output varies between runs and models. Weaker models sometimes miss an issue or rate its
severity differently; the structure of the output is guaranteed by validation, but its judgement is not.
