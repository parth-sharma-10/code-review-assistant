import { randomBytes } from 'node:crypto';

export interface ContextFile {
  path: string;
  content: string;
}

export interface BuiltContext {
  /** Random per-request token. Source code cannot forge a closing delimiter it cannot predict. */
  boundary: string;
  text: string;
  included: string[];
  omitted: string[];
  truncated: string[];
}

/**
 * Formats files as delimited, line-numbered blocks, stopping at a character budget. Numbered
 * lines let the model cite real line numbers instead of counting (which it does badly).
 * Files that do not fit are reported as omitted so the UI can say what was not reviewed.
 */
export function buildFileContext(files: ContextFile[], budgetChars: number): BuiltContext {
  const boundary = randomBytes(6).toString('hex');
  const blocks: string[] = [];
  const included: string[] = [];
  const omitted: string[] = [];
  const truncated: string[] = [];
  let used = 0;

  for (const file of files) {
    let body = numberLines(file.content);
    const overhead = file.path.length + 80;
    const remaining = budgetChars - used - overhead;
    if (body.length > remaining) {
      // Truncate only the first file; later files that don't fit are skipped, not mangled.
      if (included.length > 0 || remaining < 2000) {
        omitted.push(file.path);
        continue;
      }
      body = `${body.slice(0, remaining)}\n... [truncated: file exceeds the context budget]`;
      truncated.push(file.path);
    }
    const block = `<<<FILE ${boundary} path="${file.path}">>>\n${body}\n<<<END FILE ${boundary}>>>`;
    blocks.push(block);
    included.push(file.path);
    used += block.length;
  }
  return { boundary, text: blocks.join('\n\n'), included, omitted, truncated };
}

export function numberLines(content: string): string {
  return content
    .split('\n')
    .map((line, i) => `${i + 1}| ${line}`)
    .join('\n');
}

export function lineCount(content: string): number {
  return content.split('\n').length;
}
