import { FakeOpenAI } from '../../test/fake-openai';
import { AiProviderError, OpenAICompatibleChatModel } from './chat-model';

describe('OpenAICompatibleChatModel', () => {
  const fake = new FakeOpenAI();
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = await fake.start();
  });
  afterEach(() => fake.reset());
  afterAll(() => fake.stop());

  const model = (
    overrides: Partial<{ apiKey: string | null; timeoutMs: number; baseUrl: string }> = {},
  ) =>
    new OpenAICompatibleChatModel({
      baseUrl,
      apiKey: 'sk-test',
      model: 'm1',
      timeoutMs: 2000,
      ...overrides,
    });

  it('posts to {baseUrl}/chat/completions with the model and a bearer key', async () => {
    fake.reply({ content: 'hello' });
    await expect(model().complete([{ role: 'user', content: 'hi' }])).resolves.toBe('hello');
    expect(fake.requests[0]).toMatchObject({
      url: '/v1/chat/completions',
      authorization: 'Bearer sk-test',
      body: { model: 'm1', messages: [{ role: 'user', content: 'hi' }] },
    });
  });

  it('sends no Authorization header when no key is configured (LM Studio / Ollama)', async () => {
    fake.reply({ content: 'ok' });
    await model({ apiKey: null }).complete([{ role: 'user', content: 'hi' }]);
    expect(fake.requests[0].authorization).toBeUndefined();
  });

  it('strips <think> blocks emitted by reasoning models', async () => {
    fake.reply({ content: '<think>hmm</think>\n{"a":1}' });
    await expect(model().complete([])).resolves.toBe('{"a":1}');
  });

  it('surfaces the provider error message for HTTP errors', async () => {
    fake.reply({ status: 404, body: { error: { message: 'model "m1" not found' } } });
    await expect(model().complete([])).rejects.toMatchObject({
      kind: 'http',
      message: 'AI provider returned HTTP 404: model "m1" not found',
    });
  });

  it('rejects malformed success responses', async () => {
    fake.reply({ body: { choices: [] } });
    await expect(model().complete([])).rejects.toMatchObject({ kind: 'bad-response' });
  });

  it('times out', async () => {
    fake.reply({ content: 'late', delayMs: 500 });
    await expect(model({ timeoutMs: 100 }).complete([])).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('reports unreachable providers without leaking the key', async () => {
    const err = await model({ baseUrl: 'http://127.0.0.1:9/v1' })
      .complete([])
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect((err as AiProviderError).kind).toBe('unreachable');
    expect((err as Error).message).not.toContain('sk-test');
  });
});
