import { createServer, IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface RecordedRequest {
  url: string;
  authorization?: string;
  body: { model: string; messages: { role: string; content: string }[] };
}

type Reply = { status?: number; content?: string; body?: unknown; delayMs?: number };

/**
 * A minimal OpenAI-compatible /chat/completions server. Tests queue replies and inspect the
 * requests the app sent, so the real HTTP client, prompts and validation are all exercised.
 */
export class FakeOpenAI {
  readonly requests: RecordedRequest[] = [];
  private readonly replies: Reply[] = [];
  private server!: Server;

  async start(): Promise<string> {
    this.server = createServer(async (req, res) => {
      const body = JSON.parse(await readBody(req));
      this.requests.push({ url: req.url ?? '', authorization: req.headers.authorization, body });
      const reply = this.replies.shift() ?? { content: 'OK' };
      if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs));
      res.writeHead(reply.status ?? 200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify(
          reply.body ?? { choices: [{ message: { role: 'assistant', content: reply.content } }] },
        ),
      );
    });
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/v1`;
  }

  reply(...replies: Reply[]) {
    this.replies.push(...replies);
  }

  reset() {
    this.requests.length = 0;
    this.replies.length = 0;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}
