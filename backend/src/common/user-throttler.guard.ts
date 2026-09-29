import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthedRequest } from './decorators';

/**
 * Rate-limit key: the authenticated user, else the email being tried (login/register), else the IP.
 *
 * In local development all traffic arrives via the Next.js rewrite proxy, which does not add
 * X-Forwarded-For, so every request shares the loopback IP. Keying by user/email keeps limits
 * meaningful per account. Production should sit behind a proxy that sets X-Forwarded-For.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: AuthedRequest): Promise<string> {
    if (req.user) return `user:${req.user.id}`;
    const email: unknown = req.body?.email;
    if (typeof email === 'string' && email.length > 0) {
      return `email:${email.trim().toLowerCase()}`;
    }
    return `ip:${req.ip}`;
  }
}
