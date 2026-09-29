import { structuredPatch } from 'diff';

export interface AnnotatedDiff {
  text: string;
  added: number;
  removed: number;
}

/**
 * Renders a unified diff with NEW-version line numbers in the margin, so the model can cite
 * real line numbers instead of computing them from hunk headers:
 *   "+   12| added line"   "-     | removed line"   "    13| context line"
 */
export function annotatedDiff(before: string, after: string, context = 3): AnnotatedDiff {
  const patch = structuredPatch('a', 'b', before, after, '', '', { context });
  const out: string[] = [];
  let added = 0;
  let removed = 0;

  for (const hunk of patch.hunks) {
    out.push(
      `@@ old ${hunk.oldStart},${hunk.oldLines} -> new ${hunk.newStart},${hunk.newLines} @@`,
    );
    let newLine = hunk.newStart;
    for (const line of hunk.lines) {
      const marker = line[0];
      const code = line.slice(1);
      if (marker === '+') {
        out.push(`+ ${String(newLine).padStart(5)}| ${code}`);
        newLine++;
        added++;
      } else if (marker === '-') {
        out.push(`- ${' '.repeat(5)}| ${code}`);
        removed++;
      } else if (marker === ' ') {
        out.push(`  ${String(newLine).padStart(5)}| ${code}`);
        newLine++;
      }
      // "\ No newline at end of file" markers carry no information for review; skip them.
    }
  }
  return { text: out.join('\n'), added, removed };
}
