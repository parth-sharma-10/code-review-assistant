import { z } from 'zod';

/**
 * Contracts for model output. The model's JSON is untrusted: it is parsed and validated against
 * these before anything is stored or shown. Small normalisations (case, numeric strings) are
 * accepted so weaker local models do not fail on trivia; anything structurally wrong fails.
 */

const upper = (v: unknown) => (typeof v === 'string' ? v.trim().toUpperCase() : v);

export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export const severitySchema = z.preprocess(upper, z.enum(SEVERITIES));
export type Severity = z.infer<typeof severitySchema>;

const lineNumber = z.preprocess(
  (v) => (v === undefined || v === '' ? null : typeof v === 'string' ? Number(v) : v),
  z.number().int().positive().nullable(),
);

const text = (max: number) => z.string().trim().min(1).max(max);
const recommendations = z.array(text(1000)).max(20).default([]);

export const reviewIssueSchema = z.object({
  title: text(300),
  description: text(4000),
  severity: severitySchema,
  file: text(1024),
  line: lineNumber,
  recommendation: text(4000),
});

export const reviewResultSchema = z.object({
  summary: text(4000),
  issues: z.array(reviewIssueSchema).max(50),
  recommendations,
});
export type ReviewResult = z.infer<typeof reviewResultSchema>;

export const DIFF_CATEGORIES = ['BUG', 'SECURITY', 'PERFORMANCE', 'RISK', 'QUALITY'] as const;

export const diffReviewSchema = z.object({
  summary: text(4000),
  risk: z.preprocess(upper, z.enum(['LOW', 'MEDIUM', 'HIGH'])),
  issues: z
    .array(
      z.object({
        title: text(300),
        description: text(4000),
        severity: severitySchema,
        category: z.preprocess(upper, z.enum(DIFF_CATEGORIES)),
        line: lineNumber,
        recommendation: text(4000),
      }),
    )
    .max(50),
  recommendations,
});
export type DiffReviewResult = z.infer<typeof diffReviewSchema>;

export const architectureSchema = z.object({
  overview: text(6000),
  components: z
    .array(
      z.object({
        name: text(200),
        path: z.preprocess((v) => (v === undefined || v === '' ? null : v), text(1024).nullable()),
        responsibility: text(2000),
      }),
    )
    .max(30),
  dataFlow: text(6000),
  dependencies: z.array(z.object({ name: text(200), purpose: text(1000) })).max(40),
  concerns: z
    .array(z.object({ title: text(300), description: text(4000), severity: severitySchema }))
    .max(20),
  recommendations,
});
export type ArchitectureResult = z.infer<typeof architectureSchema>;
