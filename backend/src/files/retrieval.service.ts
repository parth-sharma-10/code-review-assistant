import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STOPWORDS = new Set(
  (
    'the a an and or but is are was were be been being to of in on at for with by from as into ' +
    'how what where which who whom why when does do did done can could should would will this that ' +
    'these those it its i me my we our you your they them their there here file files code project ' +
    'function functions explain show tell find about work works working use used using handle handles ' +
    'handled handling implement implemented implementation get set make any all some please'
  ).split(' '),
);

/** Files that are large and rarely informative; never chosen as review/chat context. */
const LOW_VALUE = [
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock|composer\.lock|go\.sum|Gemfile\.lock)$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.svg$/,
];

const OVERVIEW_FILES = [
  /^readme(\.md)?$/i,
  /(^|\/)package\.json$/,
  /(^|\/)(main|index|app|server)\.(ts|js|tsx|jsx|py|go)$/,
  /(^|\/)app\.module\.ts$/,
];

export const REVIEW_TERMS: Record<'SECURITY' | 'PERFORMANCE' | 'QUALITY', string[]> = {
  SECURITY: [
    'auth',
    'password',
    'token',
    'secret',
    'jwt',
    'session',
    'cookie',
    'login',
    'crypto',
    'hash',
    'query',
    'sql',
    'exec',
    'eval',
    'upload',
    'permission',
    'role',
    'admin',
    'key',
    'sanitize',
  ],
  PERFORMANCE: [
    'query',
    'findmany',
    'select',
    'loop',
    'for (',
    'map(',
    'foreach',
    'await',
    'cache',
    'sort',
    'filter(',
    'readfile',
    'sync',
    'useeffect',
    'render',
    'fetch',
    'join',
    'index',
  ],
  QUALITY: [
    'service',
    'controller',
    'class',
    'function',
    'export',
    'catch',
    'error',
    'util',
    'helper',
  ],
};

export interface RankedFile {
  id: string;
  path: string;
  size: number;
  score: number;
}

/** Lower-cased search terms from a natural-language question (identifiers split on case too). */
export function extractTerms(question: string, max = 12): string[] {
  const words = question
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .flatMap((w) => [w, ...w.split(/[._-]/)])
    .map((w) => w.replace(/^[._-]+|[._-]+$/g, ''))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  const terms = new Set<string>();
  for (const w of words) {
    terms.add(w);
    // Crude singularisation: "tokens" also matches "token".
    if (w.length > 4 && w.endsWith('s')) terms.add(w.slice(0, -1));
  }
  return [...terms].slice(0, max);
}

export function isLowValue(path: string): boolean {
  return LOW_VALUE.some((p) => p.test(path));
}

/**
 * Keyword retrieval. Scoring runs in Postgres so file contents never leave the database until
 * the top candidates are chosen:
 *   score = 3 x (terms appearing in the path) + sum over terms of ln(1 + occurrences in content)
 * The log damps files that merely repeat one word. This is a full scan of the project's files
 * (fine at the upload limit of 2,000 files); see ARCHITECTURE.md for how it would scale.
 */
@Injectable()
export class RetrievalService {
  constructor(private readonly prisma: PrismaService) {}

  async rank(projectId: string, terms: string[]): Promise<RankedFile[]> {
    if (terms.length === 0) return [];
    const rows = await this.prisma.$queryRaw<RankedFile[]>`
      SELECT f.id, f.path, f.size,
        (
          3 * (SELECT count(*) FROM unnest(${terms}::text[]) AS t(term)
               WHERE position(t.term IN lower(f.path)) > 0)
          + (SELECT coalesce(sum(ln(1 + (length(lower(f.content))
                   - length(replace(lower(f.content), t.term, ''))) / length(t.term))), 0)
             FROM unnest(${terms}::text[]) AS t(term))
        )::float8 AS score
      FROM files f
      WHERE f."projectId" = ${projectId}::uuid
      ORDER BY score DESC, f.path ASC
      LIMIT 60`;
    return rows.filter((r) => r.score > 0 && !isLowValue(r.path));
  }

  /** Chat context: the best keyword matches, or the project's entry points if nothing matches. */
  async forQuestion(projectId: string, question: string, budgetChars: number) {
    const ranked = await this.rank(projectId, extractTerms(question));
    const candidates =
      ranked.length > 0 ? ranked.slice(0, 12) : await this.overviewFiles(projectId);
    return this.load(pickWithinBudget(candidates, budgetChars).picked);
  }

  /**
   * Whole-project review context: files most relevant to the review mode first, then the rest,
   * cut to the character budget *before* any content is loaded.
   */
  async forProjectReview(projectId: string, mode: keyof typeof REVIEW_TERMS, budgetChars: number) {
    const all = await this.prisma.file.findMany({
      where: { projectId },
      select: { id: true, path: true, size: true },
      orderBy: { path: 'asc' },
    });
    const ranked = await this.rank(projectId, REVIEW_TERMS[mode]);
    const rankedIds = new Set(ranked.map((r) => r.id));
    const ordered = [...ranked, ...all.filter((f) => !rankedIds.has(f.id) && !isLowValue(f.path))];
    const { picked, omitted } = pickWithinBudget(ordered, budgetChars);
    return { files: await this.load(picked), omitted };
  }

  private async overviewFiles(projectId: string) {
    const files = await this.prisma.file.findMany({
      where: { projectId },
      select: { id: true, path: true, size: true },
    });
    return files.filter((f) => OVERVIEW_FILES.some((p) => p.test(f.path))).slice(0, 6);
  }

  /** Loads contents for the given ids, preserving the given order. */
  private async load(ids: string[]) {
    if (ids.length === 0) return [];
    const files = await this.prisma.file.findMany({
      where: { id: { in: ids } },
      select: { id: true, path: true, content: true },
    });
    const byId = new Map(files.map((f) => [f.id, f]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }
}

/**
 * Greedy selection by stored byte size, in priority order. A file that does not fit is skipped
 * so a smaller, lower-ranked one can still use the space. The first file is always taken (it is
 * truncated later if it alone exceeds the budget).
 */
export function pickWithinBudget(
  candidates: { id: string; path: string; size: number }[],
  budgetChars: number,
): { picked: string[]; omitted: string[] } {
  const picked: string[] = [];
  const omitted: string[] = [];
  let used = 0;
  for (const c of candidates) {
    if (picked.length === 0 || used + c.size <= budgetChars) {
      picked.push(c.id);
      used += c.size;
    } else {
      omitted.push(c.path);
    }
  }
  return { picked, omitted };
}
