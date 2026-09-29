# Decision: session JWT in an httpOnly cookie, Argon2id passwords

## Problem

Users need accounts, and the API must know who is calling on every request. The token has to survive
page reloads without being readable by script, because this app renders content that came from
untrusted sources (uploaded code, model output).

## Alternatives

| Option | For | Against |
|---|---|---|
| JWT in `localStorage` + `Authorization` header | Simple; common in tutorials | Any XSS reads the token; OWASP explicitly advises against it |
| **JWT in an `httpOnly` cookie** | Script cannot read it; the browser attaches it automatically | Needs CSRF thought; revocation needs extra state |
| Server-side session table + opaque cookie | Instant revocation | A DB lookup per request; one more table to manage |
| OAuth / third-party identity | No passwords to store | Out of scope; still needs a session afterwards |

For hashing: bcrypt (72-byte input limit, CPU-hard only) versus Argon2id (memory-hard; the
Password Hashing Competition winner).

## Evidence

- OWASP Session Management Cheat Sheet: `HttpOnly` is "mandatory to prevent session ID stealing
  through XSS attacks". Session cookies should "explicitly set `SameSite=Strict` (preferred) or
  `SameSite=Lax`". On storage: "Do not store authentication tokens, session IDs, JWTs, refresh tokens,
  or any credential in `localStorage` or `sessionStorage`."
  https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP Password Storage Cheat Sheet: "Use Argon2id with a minimum configuration of 19 MiB of memory,
  an iteration count of 2, and 1 degree of parallelism."
  https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- node-argon2 0.45 defaults, read from `node_modules/argon2/argon2.cjs`: `type: argon2id`,
  `memoryCost: 65536` (64 MiB), `timeCost: 3`, `parallelism: 4`, which exceeds the OWASP minimum.

## Decision

- Argon2id via `argon2` with library defaults. Passwords are 8–128 characters; the upper bound caps
  hashing cost per request.
- A JWT (HS256, 24 h) in cookie `access_token`: `HttpOnly`, `SameSite=Lax`, `Secure` when
  `NODE_ENV=production`, `Path=/`.
- **Lax rather than Strict**, because the frontend's `proxy.ts` checks for the cookie on top-level
  navigations. With `Strict`, following a link to the app from another site would arrive without the
  cookie and bounce to the login page. Lax still withholds the cookie on cross-site POST, PATCH and
  DELETE, which is what CSRF needs, and no route changes state on GET.
- The browser reaches the API through a same-origin Next.js rewrite, so the cookie is first-party and
  CORS is not involved in normal use.
- A global `JwtAuthGuard` with `@Public()` as the explicit opt-out, so new routes are protected by
  default.
- On login, an unknown email verifies against a dummy Argon2 hash, so both failure paths cost roughly
  the same and return the same message.

## Tradeoffs

- **No revocation.** Logout removes the cookie from this browser only. A stolen token works until it
  expires. Accepted for scope; the fix is a `tokenVersion` column compared in the guard, which costs one
  indexed read per request.
- **No refresh tokens.** Users sign in once a day. Short-lived access tokens plus rotating refresh
  tokens would be the production answer.
- **Lax, not Strict.** A small CSRF surface remains for same-*site* attackers (for example, a
  compromised sibling subdomain). That is not relevant to a localhost deployment.
