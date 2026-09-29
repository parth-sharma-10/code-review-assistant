import type { ReviewModePrompt } from './review.prompt';

export const qualityReviewPrompt: ReviewModePrompt = {
  title: 'Code Quality Review',
  focus: [
    'Unclear or misleading naming',
    'Poor structure: functions or classes doing too much',
    'Duplicated logic that should be shared',
    'Readability problems that make the code hard to follow',
    'Maintainability risks: tight coupling, magic values, hidden side effects',
    'Error handling: swallowed errors, missing handling, unhelpful messages',
    'Separation of concerns: business logic mixed with transport, UI or persistence',
  ],
};
