import type { ReviewModePrompt } from './review.prompt';

export const performanceReviewPrompt: ReviewModePrompt = {
  title: 'Performance Review',
  focus: [
    'Inefficient algorithms or data structures (e.g. quadratic work where linear is easy)',
    'Expensive work inside loops',
    'N+1 queries and database calls inside loops',
    'Unnecessary or repeated database / network operations; missing pagination or limits',
    'Unnecessary re-renders or recomputation in UI code',
    'Memory-heavy operations (loading whole datasets or files into memory unnecessarily)',
    'Blocking or synchronous operations on hot paths (sync I/O, CPU-heavy work on the event loop)',
  ],
};
