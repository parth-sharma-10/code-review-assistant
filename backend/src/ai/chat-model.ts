export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * The only thing the rest of the app needs from an LLM vendor. Every supported provider
 * (OpenAI, LM Studio, Ollama, OpenRouter, vLLM, ...) speaks the OpenAI chat-completions
 * protocol, so one implementation covers all of them. A vendor with a different protocol
 * (e.g. Anthropic's native Messages API) would be a second class implementing this.
 */
export interface ChatModel {
  complete(messages: ChatMessage[]): Promise<string>;
}

export type AiProviderErrorKind = 'unreachable' | 'timeout' | 'http' | 'bad-response';

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly kind: AiProviderErrorKind,
  ) {
    super(message);
  }
}

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey?: string | null;
  model: string;
  timeoutMs: number;
}

export class OpenAICompatibleChatModel implements ChatModel {
  constructor(private readonly cfg: OpenAICompatibleConfig) {}

  async complete(messages: ChatMessage[]): Promise<string> {
    const url = `${this.cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.cfg.apiKey ? { authorization: `Bearer ${this.cfg.apiKey}` } : {}),
        },
        // No temperature / response_format: several compatible servers and newer OpenAI models
        // reject non-default values. Output structure is enforced by schema validation instead.
        body: JSON.stringify({ model: this.cfg.model, messages }),
        signal: AbortSignal.timeout(this.cfg.timeoutMs),
        redirect: 'error',
      });
    } catch (err) {
      // Checked by name, not instanceof: fetch rejects with a DOMException from another realm.
      if ((err as { name?: unknown } | null)?.name === 'TimeoutError') {
        throw new AiProviderError(
          `AI provider did not respond within ${Math.round(this.cfg.timeoutMs / 1000)}s`,
          'timeout',
        );
      }
      throw new AiProviderError(
        `Could not reach the AI provider at ${originOf(url)}`,
        'unreachable',
      );
    }

    if (!res.ok) {
      throw new AiProviderError(
        `AI provider returned HTTP ${res.status}${await errorDetail(res)}`,
        'http',
      );
    }
    const body = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: unknown } }[];
    } | null;
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new AiProviderError(
        'AI provider returned an empty or malformed response',
        'bad-response',
      );
    }
    return stripReasoning(content);
  }
}

/** Reasoning models served via LM Studio/Ollama (e.g. DeepSeek-R1, Qwen3) prepend <think> blocks. */
export function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return 'the configured URL';
  }
}

/** Surfaces the provider's own error message (e.g. "model not found"), bounded in length. */
async function errorDetail(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: unknown } } | null;
  const message = body?.error?.message;
  return typeof message === 'string' ? `: ${message.slice(0, 300)}` : '';
}
