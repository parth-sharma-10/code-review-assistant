import type { ChatMessage, ChatModel } from './chat-model';
import { reviewResultSchema } from './schemas';
import { AiOutputError, completeStructured, extractJson } from './structured-output';

class ScriptedModel implements ChatModel {
  readonly calls: ChatMessage[][] = [];
  constructor(private readonly replies: string[]) {}
  async complete(messages: ChatMessage[]) {
    this.calls.push(messages);
    return this.replies.shift() ?? '';
  }
}

const valid = {
  summary: 'One SQL injection.',
  issues: [
    {
      title: 'SQL injection',
      description: 'User input is concatenated into SQL.',
      severity: 'high',
      file: 'src/db.ts',
      line: '12',
      recommendation: 'Use parameterised queries.',
    },
  ],
};

describe('extractJson', () => {
  it('accepts fenced JSON and surrounding prose', () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```\nThanks')).toEqual({ a: 1 });
    expect(extractJson('Result: {"a": {"b": 2}} done')).toEqual({ a: { b: 2 } });
  });

  it('throws when there is no object', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('completeStructured', () => {
  const prompt: ChatMessage[] = [{ role: 'user', content: 'review' }];

  it('returns validated, normalised data on the first valid reply', async () => {
    const model = new ScriptedModel([JSON.stringify(valid)]);
    const result = await completeStructured(model, prompt, reviewResultSchema);
    expect(model.calls).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ severity: 'HIGH', line: 12 });
    expect(result.recommendations).toEqual([]);
  });

  it('retries once, feeding validation errors back to the model', async () => {
    const bad = { summary: 'x', issues: [{ ...valid.issues[0], severity: 'CATASTROPHIC' }] };
    const model = new ScriptedModel([JSON.stringify(bad), JSON.stringify(valid)]);
    const result = await completeStructured(model, prompt, reviewResultSchema);

    expect(model.calls).toHaveLength(2);
    const retry = model.calls[1];
    expect(retry[retry.length - 2]).toMatchObject({ role: 'assistant' });
    expect(retry[retry.length - 1].content).toContain('issues.0.severity');
    expect(result.summary).toBe('One SQL injection.');
  });

  it('recovers from non-JSON on the first attempt', async () => {
    const model = new ScriptedModel(['Sure! The code looks fine.', JSON.stringify(valid)]);
    await expect(completeStructured(model, prompt, reviewResultSchema)).resolves.toBeDefined();
    expect(model.calls[1].at(-1)?.content).toContain('not valid JSON');
  });

  it('gives up with a controlled error after two invalid replies', async () => {
    const model = new ScriptedModel(['nope', '{"summary": ""}']);
    await expect(completeStructured(model, prompt, reviewResultSchema)).rejects.toBeInstanceOf(
      AiOutputError,
    );
    expect(model.calls).toHaveLength(2);
  });
});
