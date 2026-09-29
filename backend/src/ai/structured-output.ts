import type { z } from 'zod';
import type { ChatMessage, ChatModel } from './chat-model';

export class AiOutputError extends Error {}

export const MAX_ATTEMPTS = 2;

/** Pulls the JSON object out of a reply that may be wrapped in a ``` fence or prose. */
export function extractJson(reply: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(reply);
  const candidate = fenced ? fenced[1] : reply;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('reply contains no JSON object');
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Asks for JSON, validates it, and on failure retries once with the validation errors fed back
 * to the model. After MAX_ATTEMPTS it throws a controlled error rather than returning bad data.
 */
export async function completeStructured<T>(
  model: ChatModel,
  messages: ChatMessage[],
  schema: z.ZodType<T>,
): Promise<T> {
  let conversation = messages;
  let lastProblem = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const reply = await model.complete(conversation);
    let parsed: unknown;
    try {
      parsed = extractJson(reply);
    } catch (err) {
      lastProblem = `Your reply was not valid JSON (${(err as Error).message}).`;
      conversation = withCorrection(messages, reply, lastProblem);
      continue;
    }
    const result = schema.safeParse(parsed);
    if (result.success) return result.data;

    lastProblem = result.error.issues
      .slice(0, 8)
      .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    conversation = withCorrection(
      messages,
      reply,
      `Your JSON did not match the schema:\n${lastProblem}`,
    );
  }

  throw new AiOutputError(
    `The AI provider returned output that did not match the required format after ${MAX_ATTEMPTS} attempts. ` +
      'Try again, or use a more capable model.',
  );
}

function withCorrection(original: ChatMessage[], reply: string, problem: string): ChatMessage[] {
  return [
    ...original,
    { role: 'assistant', content: reply.slice(0, 8000) },
    {
      role: 'user',
      content: `${problem}\n\nRespond again with ONLY the corrected JSON object, no prose and no code fences.`,
    },
  ];
}
