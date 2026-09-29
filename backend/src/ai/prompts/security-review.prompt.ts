import type { ReviewModePrompt } from './review.prompt';

export const securityReviewPrompt: ReviewModePrompt = {
  title: 'Security Review',
  focus: [
    'Hardcoded secrets, credentials, API keys or private keys',
    'Authentication flaws (weak password handling, token validation, session management)',
    'Authorization flaws (missing ownership checks, IDOR, privilege escalation)',
    'Injection: SQL, NoSQL, command, path traversal, template, XSS',
    'Missing or insufficient input validation at trust boundaries',
    'Unsafe deserialization or use of eval / dynamic code execution',
    'Sensitive data exposure in logs, errors, responses or storage',
    'Insecure dependencies, only when a version and a known weakness are visible in the supplied files',
  ],
};
