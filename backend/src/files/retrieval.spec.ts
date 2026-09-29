import { extractTerms, isLowValue, pickWithinBudget } from './retrieval.service';

describe('extractTerms', () => {
  it('drops stopwords, splits identifiers and adds simple singulars', () => {
    const terms = extractTerms('How does the JwtAuthGuard validate tokens?');
    expect(terms).toEqual(
      expect.arrayContaining(['jwt', 'auth', 'guard', 'validate', 'tokens', 'token']),
    );
    expect(terms).not.toContain('how');
    expect(terms).not.toContain('the');
  });

  it('splits dotted and dashed names', () => {
    expect(extractTerms('where is auth.service.ts')).toEqual(
      expect.arrayContaining(['auth', 'service']),
    );
  });

  it('returns nothing for a question made only of stopwords', () => {
    expect(extractTerms('how does it work?')).toEqual([]);
  });
});

describe('pickWithinBudget', () => {
  const f = (id: string, size: number) => ({ id, path: `${id}.ts`, size });

  it('takes files in priority order and skips ones that do not fit', () => {
    expect(pickWithinBudget([f('a', 60), f('b', 50), f('c', 30)], 100)).toEqual({
      picked: ['a', 'c'],
      omitted: ['b.ts'],
    });
  });

  it('always takes the first file, even if it alone exceeds the budget', () => {
    expect(pickWithinBudget([f('huge', 500), f('small', 10)], 100).picked).toEqual(['huge']);
  });
});

describe('isLowValue', () => {
  it('excludes lockfiles and minified bundles from AI context', () => {
    expect(isLowValue('package-lock.json')).toBe(true);
    expect(isLowValue('web/yarn.lock')).toBe(true);
    expect(isLowValue('dist/app.min.js')).toBe(true);
    expect(isLowValue('src/app.ts')).toBe(false);
  });
});
