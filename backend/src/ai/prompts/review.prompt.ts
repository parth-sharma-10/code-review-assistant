import type { ChatMessage } from '../chat-model';
import { jsonOutputRules, SEVERITY_GUIDE, untrustedContextRules } from './shared';

// v2: stricter focus rule after v1 let small models report security issues in performance reviews.
export const REVIEW_PROMPT_VERSION = 'review-v2';

export interface ReviewModePrompt {
  title: string;
  focus: string[];
}

const REVIEW_SHAPE = `{
  "summary": string,            // 1-3 sentences on overall findings for this review type
  "issues": [                   // definite problems demonstrated by the code; [] if none
    {
      "title": string,
      "description": string,    // what is wrong and why it matters, citing the code
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "file": string,           // exactly as it appears in a FILE header
      "line": number | null,    // line number from the left margin, or null if not line-specific
      "recommendation": string  // concrete remediation
    }
  ],
  "recommendations": string[]   // optional improvements that are not definite problems
}`;

export function buildReviewMessages(
  mode: ReviewModePrompt,
  context: { boundary: string; text: string; included: string[] },
): ChatMessage[] {
  const system = [
    `You are a senior software engineer performing a ${mode.title} of source code.`,
    '',
    'FOCUS',
    ...mode.focus.map((f) => `- ${f}`),
    '',
    'RULES',
    '1. Analyse only the supplied files. Do not assume the contents of files you were not shown.',
    '2. Never invent files, findings or line numbers. "file" must be one of the supplied paths; if you cannot point to a line, use null.',
    '3. Only put a problem in "issues" if the supplied code demonstrates it. Suggestions, best practices and anything speculative belong in "recommendations".',
    `4. Report only problems covered by the FOCUS list above. Leave out problems that belong to a different kind of review (for example, do not report security vulnerabilities in a performance review).`,
    '5. Be concise. Every issue needs an actionable recommendation.',
    '6. An empty "issues" array is a valid answer. Do not pad the review.',
    '',
    SEVERITY_GUIDE,
    '',
    untrustedContextRules(context.boundary),
    '',
    jsonOutputRules(REVIEW_SHAPE),
  ].join('\n');

  const user = [
    `Perform the ${mode.title} of these ${context.included.length} file(s): ${context.included.join(', ')}`,
    '',
    context.text,
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
