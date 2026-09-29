import type { CookieOptions } from 'express';
import { config } from '../config';

export const AUTH_COOKIE = 'access_token';
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 1 day; no refresh tokens (see ARCHITECTURE.md)

export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true, // not readable by JavaScript, so XSS cannot exfiltrate the token
    secure: config().NODE_ENV === 'production',
    sameSite: 'lax', // not sent on cross-site POST/PATCH/DELETE, which blocks CSRF on mutations
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}
