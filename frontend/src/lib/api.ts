export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Body = Record<string, unknown> | FormData;
interface Options {
  method?: string;
  body?: Body;
}

/**
 * All requests go to /api (same origin, proxied to the backend). The httpOnly session cookie
 * is attached by the browser; this code never sees the token.
 */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const res = await send(path, options);
  if (res.status === 401 && !path.startsWith("/auth/")) return endSession();
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status);
  return data as T;
}

async function send(path: string, { method, body }: Options): Promise<Response> {
  const isJson = body !== undefined && !(body instanceof FormData);
  try {
    return await fetch(`/api${path}`, {
      method: method ?? (body ? "POST" : "GET"),
      headers: isJson ? { "content-type": "application/json" } : undefined,
      body: isJson ? JSON.stringify(body) : (body as FormData | undefined),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("Cannot reach the server. Check that the backend is running.", 0);
  }
}

/** The backend rejected the session cookie (expired, or the server's secret changed). */
async function endSession(): Promise<never> {
  // Clear the rejected cookie first; otherwise proxy.ts sees it and bounces /login back here.
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  const next = encodeURIComponent(window.location.pathname);
  // A full navigation (not router.push) deliberately discards all client state from the old session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${next}`);
  throw new ApiError("Your session has expired. Sign in again.", 401);
}

function errorMessage(data: unknown, status: number): string {
  const message = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(". ");
  if (typeof message === "string") return message;
  if (status === 413) return "The file is larger than the 20 MB upload limit.";
  if (status === 429) return "Too many requests. Wait a minute and try again.";
  if (status >= 500) return "The server hit an error. Try again.";
  return `Request failed (${status})`;
}
