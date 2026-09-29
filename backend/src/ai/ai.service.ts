import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { ChatMessage, ChatModel } from './chat-model';
import { buildFileContext, ContextFile, lineCount } from './context';
import { annotatedDiff } from './diff';
import {
  ARCHITECTURE_PROMPT_VERSION,
  buildArchitectureMessages,
} from './prompts/architecture.prompt';
import { buildChatMessages, CHAT_PROMPT_VERSION } from './prompts/chat.prompt';
import { buildDiffReviewMessages, DIFF_PROMPT_VERSION } from './prompts/diff-review.prompt';
import { performanceReviewPrompt } from './prompts/performance-review.prompt';
import { qualityReviewPrompt } from './prompts/quality-review.prompt';
import { buildReviewMessages, REVIEW_PROMPT_VERSION } from './prompts/review.prompt';
import { securityReviewPrompt } from './prompts/security-review.prompt';
import {
  architectureSchema,
  ArchitectureResult,
  diffReviewSchema,
  DiffReviewResult,
  reviewResultSchema,
  ReviewResult,
} from './schemas';
import { completeStructured } from './structured-output';

export type ReviewMode = 'SECURITY' | 'PERFORMANCE' | 'QUALITY';

const REVIEW_MODES = {
  SECURITY: securityReviewPrompt,
  PERFORMANCE: performanceReviewPrompt,
  QUALITY: qualityReviewPrompt,
} as const;

/** Character budgets (~4 chars per token). Keeps requests inside a 16k-32k token context window. */
export const BUDGETS = {
  review: 60_000,
  diff: 40_000,
  architectureKeyFiles: 30_000,
  architectureTree: 12_000,
  chat: 30_000,
};

export interface ReviewOutcome {
  result: ReviewResult;
  meta: {
    promptVersion: string;
    reviewedFiles: string[];
    omittedFiles: string[];
    truncatedFiles: string[];
    /** Issues dropped because they cited a file that was not supplied. */
    discardedIssues: number;
  };
}

/**
 * The application's AI operations. Everything here is provider-agnostic: it depends only on
 * the ChatModel interface. Prompt building, output validation and grounding live here, not in
 * controllers.
 */
@Injectable()
export class AiService {
  async generateReview(
    model: ChatModel,
    mode: ReviewMode,
    files: ContextFile[],
  ): Promise<ReviewOutcome> {
    const context = buildFileContext(files, BUDGETS.review);
    const messages = buildReviewMessages(REVIEW_MODES[mode], context);
    const raw = await completeStructured(model, messages, reviewResultSchema);

    const lines = new Map(
      files
        .filter((f) => context.included.includes(f.path))
        .map((f) => [f.path, lineCount(f.content)]),
    );
    const { result, discarded } = groundReview(raw, lines);
    return {
      result,
      meta: {
        promptVersion: REVIEW_PROMPT_VERSION,
        reviewedFiles: context.included,
        omittedFiles: context.omitted,
        truncatedFiles: context.truncated,
        discardedIssues: discarded,
      },
    };
  }

  async generateDiffReview(
    model: ChatModel,
    base: ContextFile,
    compare: ContextFile,
  ): Promise<{ result: DiffReviewResult; meta: Record<string, unknown> }> {
    const diff = annotatedDiff(base.content, compare.content);
    const truncated = diff.text.length > BUDGETS.diff;
    const text = truncated
      ? `${diff.text.slice(0, BUDGETS.diff)}\n... [diff truncated: exceeds the context budget]`
      : diff.text;
    const messages = buildDiffReviewMessages({
      boundary: randomBytes(6).toString('hex'),
      basePath: base.path,
      comparePath: compare.path,
      diff: text,
    });
    const result = await completeStructured(model, messages, diffReviewSchema);

    const maxLine = lineCount(compare.content);
    for (const issue of result.issues) {
      if (issue.line !== null && issue.line > maxLine) issue.line = null;
    }
    return {
      result,
      meta: {
        promptVersion: DIFF_PROMPT_VERSION,
        linesAdded: diff.added,
        linesRemoved: diff.removed,
        diffTruncated: truncated,
      },
    };
  }

  async generateArchitectureAnalysis(
    model: ChatModel,
    allPaths: string[],
    keyFiles: ContextFile[],
  ): Promise<{ result: ArchitectureResult; meta: Record<string, unknown> }> {
    const tree = renderTree(allPaths, BUDGETS.architectureTree);
    const context = buildFileContext(keyFiles, BUDGETS.architectureKeyFiles);
    const messages = buildArchitectureMessages({
      boundary: context.boundary,
      tree,
      fileCount: allPaths.length,
      keyFiles: context.text || '(no manifests or entry points found)',
    });
    const result = await completeStructured(model, messages, architectureSchema);

    // A component path must exist as a file or directory prefix; otherwise it was invented.
    const known = new Set(allPaths);
    for (const component of result.components) {
      const p = component.path?.replace(/^\.?\//, '').replace(/\/$/, '');
      if (p && !known.has(p) && !allPaths.some((f) => f.startsWith(`${p}/`))) component.path = null;
    }
    return {
      result,
      meta: { promptVersion: ARCHITECTURE_PROMPT_VERSION, keyFiles: context.included },
    };
  }

  async chat(
    model: ChatModel,
    input: {
      question: string;
      history: ChatMessage[];
      files: ContextFile[];
      projectFileCount: number;
    },
  ): Promise<{ answer: string; contextFiles: string[]; promptVersion: string }> {
    const context = buildFileContext(input.files, BUDGETS.chat);
    const messages = buildChatMessages({
      boundary: context.boundary,
      context: context.text,
      included: context.included,
      projectFileCount: input.projectFileCount,
      history: input.history,
      question: input.question,
    });
    const answer = stripLineNumberPrefixes(await model.complete(messages));
    return { answer, contextFiles: context.included, promptVersion: CHAT_PROMPT_VERSION };
  }
}

/** Drops issues citing files the model was not shown; nulls line numbers beyond the file end. */
export function groundReview(
  raw: ReviewResult,
  lineCounts: Map<string, number>,
): { result: ReviewResult; discarded: number } {
  const issues = raw.issues.flatMap((issue) => {
    const file = issue.file.replace(/^\.?\//, '');
    const lines = lineCounts.get(file);
    if (lines === undefined) return [];
    const line = issue.line !== null && issue.line <= lines ? issue.line : null;
    return [{ ...issue, file, line }];
  });
  return { result: { ...raw, issues }, discarded: raw.issues.length - issues.length };
}

/**
 * Models often copy the "12| " margin from the context into quoted code, even when told not to
 * (observed with qwen2.5-coder:7b). Strip it from fenced blocks where most lines carry it.
 */
export function stripLineNumberPrefixes(answer: string): string {
  return answer.replace(/```([^\n]*)\n([\s\S]*?)```/g, (block, lang: string, body: string) => {
    const lines = body.split('\n').filter((l) => l.trim().length > 0);
    const prefixed = lines.filter((l) => /^\s*\d+\| ?/.test(l)).length;
    if (lines.length === 0 || prefixed < lines.length / 2) return block;
    return '```' + lang + '\n' + body.replace(/^\s*\d+\| ?/gm, '') + '```';
  });
}

function renderTree(paths: string[], budget: number): string {
  const lines: string[] = [];
  let used = 0;
  for (const p of paths) {
    if (used + p.length + 1 > budget) {
      lines.push(`... and ${paths.length - lines.length} more files`);
      break;
    }
    lines.push(p);
    used += p.length + 1;
  }
  return lines.join('\n');
}
