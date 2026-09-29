import type { ChatMessage } from '../chat-model';
import { untrustedContextRules } from './shared';

// v2: v1 answers copied the "12| " line-number prefixes into quoted code.
export const CHAT_PROMPT_VERSION = 'chat-v2';

export function buildChatMessages(input: {
  boundary: string;
  context: string;
  included: string[];
  projectFileCount: number;
  history: ChatMessage[];
  question: string;
}): ChatMessage[] {
  const system = [
    "You are an assistant that answers questions about the user's codebase.",
    '',
    'RULES',
    `1. The project has ${input.projectFileCount} files. For each question you are shown only the files a keyword search judged most relevant, not the whole project.`,
    '2. Answer from the supplied files. Cite them as `path:line` so the user can navigate.',
    '3. If the supplied files do not contain the answer, say so plainly and suggest what to search for. Do not guess about files you were not shown.',
    '4. Be concise. Use Markdown; put code in fenced blocks.',
    '5. When quoting code, remove the line-number prefixes ("12| "); quote only the code itself.',
    '',
    untrustedContextRules(input.boundary),
  ].join('\n');

  const contextBlock =
    input.included.length > 0
      ? `Relevant files (${input.included.join(', ')}):\n\n${input.context}`
      : 'No files matched this question.';

  return [
    { role: 'system', content: system },
    ...input.history,
    { role: 'user', content: `${contextBlock}\n\nQUESTION\n${input.question}` },
  ];
}
