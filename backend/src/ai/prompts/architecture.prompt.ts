import type { ChatMessage } from '../chat-model';
import { jsonOutputRules, SEVERITY_GUIDE, untrustedContextRules } from './shared';

export const ARCHITECTURE_PROMPT_VERSION = 'architecture-v1';

const ARCHITECTURE_SHAPE = `{
  "overview": string,          // what the system is and how it is organised, 1-2 paragraphs
  "components": [ { "name": string, "path": string | null, "responsibility": string } ],
  "dataFlow": string,          // how a typical request/data moves through the components
  "dependencies": [ { "name": string, "purpose": string } ],  // frameworks/libraries seen in manifests
  "concerns": [ { "title": string, "description": string, "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" } ],
  "recommendations": string[]
}`;

export function buildArchitectureMessages(input: {
  boundary: string;
  tree: string;
  fileCount: number;
  keyFiles: string;
}): ChatMessage[] {
  const system = [
    'You are a software architect analysing an unfamiliar repository.',
    'You are given the complete file tree plus the contents of manifests, entry points and other key files.',
    '',
    'RULES',
    '1. Describe only what the tree and supplied files show. If something cannot be inferred (e.g. deployment, runtime scale), say it is unknown instead of guessing.',
    '2. "path" in components must be a directory or file that appears in the tree, or null.',
    '3. "dependencies" must come from manifests you were shown.',
    '4. "concerns" are architectural (coupling, layering, missing boundaries, config/secrets handling), not line-level bugs.',
    '5. Be concise.',
    '',
    SEVERITY_GUIDE,
    '',
    untrustedContextRules(input.boundary),
    '',
    jsonOutputRules(ARCHITECTURE_SHAPE),
  ].join('\n');

  const user = [
    `FILE TREE (${input.fileCount} files)`,
    input.tree,
    '',
    'KEY FILES',
    input.keyFiles,
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
