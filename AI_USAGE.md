# AI Usage

## 1. Overview

AI tools were used as development assistants throughout the project, primarily **Claude** and **ChatGPT**.

The AI tools were not treated as autonomous decision-makers. I used them to accelerate implementation, explore alternatives, debug issues, review code, improve documentation, and validate ideas. I remained responsible for the product requirements, architecture, engineering trade-offs, security requirements, testing strategy, integration, and final review of the implementation.

The development process was iterative:

1. Define the requirement or engineering problem.
2. Research possible approaches and identify constraints.
3. Discuss or prototype the approach using Claude or ChatGPT.
4. Implement and integrate the solution.
5. Run tests and manual verification.
6. Inspect failures and edge cases.
7. Refine the implementation.
8. Review the final result against the original requirements.

AI output was therefore treated as **untrusted development input**, rather than code that could automatically be accepted into the project.

---

## 2. AI Tools Used

### Claude / Claude Code

Claude was the primary AI development assistant.

It was used for:

* Implementing and iterating on backend modules.
* Implementing frontend components and pages.
* Writing and improving automated tests.
* Debugging TypeScript, NestJS, Next.js, Prisma and integration issues.
* Exploring implementation alternatives.
* Reviewing code for security and correctness issues.
* Researching framework/library behaviour when necessary.
* Improving documentation and developer-facing explanations.
* Performing iterative refactoring after testing.

Claude was particularly useful for quickly producing implementation candidates that I could then inspect, test, modify and integrate.

### ChatGPT

ChatGPT was used primarily as a **planning, reasoning and review assistant**.

It was used for:

* Breaking large requirements into implementation tasks.
* Discussing architecture and trade-offs.
* Reviewing proposed designs before implementation.
* Explaining unfamiliar framework/library behaviour.
* Identifying security and edge-case considerations.
* Reviewing implementation decisions.
* Brainstorming testing strategies.
* Improving technical documentation.
* Challenging assumptions and looking for failure cases.

I used ChatGPT as a second perspective rather than relying exclusively on the implementation produced by Claude.

---

## 3. Prompts Used

The prompts were iterative rather than one large prompt that generated the entire application. They generally followed the engineering problem being solved.

Representative prompts included:

### Architecture and planning

> "Analyze the requirements and propose a small, maintainable architecture for this application. Prioritize clear module boundaries, security, testability and the constraints of the assessment."

> "Review this architecture and identify unnecessary infrastructure, over-engineering, security risks and places where the design could be simplified."

> "Given these requirements, what are the important engineering trade-offs between the possible implementations?"

### Backend implementation

> "Implement this NestJS module while preserving the existing module boundaries, validation conventions and error handling."

> "Review this service for authorization bugs, IDOR vulnerabilities, validation problems and error-handling issues."

> "Write tests for the security-sensitive behaviour in this module, including malicious and boundary cases."

### ZIP ingestion and security

> "Design a secure ZIP ingestion pipeline for untrusted repository uploads. Consider Zip Slip, zip bombs, symlinks, binary files, secrets, entry limits and decompression limits."

> "Review this ZIP extraction implementation as if it were handling attacker-controlled input. Find bypasses and edge cases."

This process resulted in explicit protections such as path validation, entry/size limits, secret-file filtering, binary detection, symlink rejection and tests for malicious archives.

### AI integration

> "Design a provider abstraction that supports OpenAI-compatible endpoints including OpenAI, Ollama, LM Studio and OpenRouter without coupling the application to a specific vendor."

> "Review the AI response handling. Treat model output as untrusted input and identify how malformed JSON, invalid schemas and hallucinated file references should be handled."

> "Improve this prompt so that a security review does not start producing performance or code-quality findings."

### Context retrieval

> "Given a repository stored in PostgreSQL, design a simple explainable retrieval strategy that selects the most relevant files within an LLM context budget without introducing a vector database."

This led to the keyword-based retrieval approach implemented in the repository, including path weighting, content occurrence scoring, context budgets and fallback files.

### Frontend and UX

> "Review this developer-tool UI and suggest improvements that make it feel like a deliberate engineering product rather than a generic AI application."

> "Improve the interface while keeping the design restrained, readable and appropriate for a code-review tool."

The final UI deliberately uses a restrained visual language around a marked-up code listing rather than relying on the common generic AI-chat aesthetic.

### Debugging

> "Here is the error and the relevant implementation. Determine the root cause, explain why it happens, and propose the smallest robust fix."

> "The tests pass in isolation but the integration flow fails. Trace the request path and identify where the assumptions diverge."

AI responses were then checked against the actual behaviour of the application rather than accepted solely because the explanation appeared plausible.

---

## 4. Generated Code

AI assistance was used to generate implementation candidates and code in several areas, including:

* NestJS modules and services.
* DTOs and validation logic.
* Prisma-related database operations.
* AI provider integration.
* Prompt construction.
* Structured AI-output validation.
* Automated tests.
* React/Next.js components.
* Utility functions.
* Error handling and integration plumbing.
* Documentation and configuration.

The important distinction is that **generated code was not treated as automatically correct**.

Generated implementations were reviewed in the context of the existing architecture and then:

* Modified to match project conventions.
* Integrated with surrounding modules.
* Tested against real application behaviour.
* Checked against security requirements.
* Simplified where generated solutions were unnecessarily complex.
* Corrected when tests or manual testing exposed problems.
* Refactored when the generated implementation did not fit the desired architecture.

For example, the AI layer does not simply trust model responses. The final implementation explicitly parses and validates structured responses with Zod, retries invalid responses with validation feedback, and rejects results that reference files that were not included in the model context.

Similarly, the ZIP ingestion implementation was treated as a security boundary rather than simply an archive-extraction utility.

---

## 5. Manually Written / Human-Owned Work

The core engineering direction of the project remained human-owned.

My responsibilities included defining and refining:

### Product requirements

I determined what the application needed to do, including:

* Repository upload and exploration.
* Security, performance and quality reviews.
* File, selected-file and project-wide review scopes.
* Review history.
* Project-specific chat.
* Diff review.
* Architecture analysis.
* Multiple AI-provider support.
* Security and upload constraints.

### Architecture

I made the decisions around the overall system structure:

* Next.js frontend.
* NestJS modular backend.
* PostgreSQL with Prisma.
* A modular-monolith architecture.
* A provider-agnostic AI abstraction.
* Database-backed source-code storage.
* Keyword-based retrieval rather than immediately introducing embeddings/vector infrastructure.
* Explicit context budgets.
* Synchronous AI requests appropriate for the assessment scale.

### Security model

Security was treated as a first-class engineering concern rather than an afterthought.

Important decisions included:

* Argon2id password hashing.
* JWT authentication in an `httpOnly` cookie.
* User-scoped database queries.
* Rate limiting on authentication routes.
* AES-256-GCM encryption for stored provider API keys.
* ZIP magic-byte validation.
* Zip Slip protection.
* Zip-bomb/decompression limits.
* Symlink rejection.
* Secret-file filtering.
* Binary/invalid UTF-8 filtering.
* Model-output schema validation.
* Grounding AI findings against the files actually supplied to the model.

### AI system design

I also made the distinction between:

**AI generation** and **application correctness**.

The model is responsible for generating candidate findings or answers, while the application is responsible for:

* Selecting context.
* Enforcing context budgets.
* Constructing prompts.
* Validating model output.
* Retrying malformed output.
* Grounding findings.
* Discarding unsupported references.
* Persisting metadata.
* Presenting results to the user.

This separation makes the system substantially more predictable than simply displaying raw model output.

### Testing strategy

I decided to test the application at multiple levels:

* Unit tests for security-sensitive utilities.
* AI schema validation tests.
* ZIP security tests.
* Retrieval tests.
* Encryption tests.
* Frontend component/utility tests.
* HTTP integration tests.
* Fake OpenAI-compatible provider tests.
* Manual browser testing.
* Real local-model testing with Ollama.

The real-model testing was especially useful because mocked model responses did not expose some prompt-quality problems. Testing with a real local model revealed issues such as off-focus findings and formatting behaviour, which were then addressed in the implementation.

---

## 6. Engineering Decisions Influenced by AI Assistance

AI tools were useful for generating alternatives, but the final engineering decisions were based on the project's requirements, testing results and constraints.

### OpenAI-compatible provider abstraction

Instead of creating separate implementations for OpenAI, Ollama, LM Studio and OpenRouter, the application uses a common OpenAI-compatible `/chat/completions` interface.

This keeps the AI layer vendor-independent while still allowing different providers to be configured by users.

### Structured output instead of trusting JSON

The model is asked for structured output, but the application does not assume that the model will obey.

Responses are parsed, validated with Zod, and retried once when invalid.

### Grounding AI findings

A model can hallucinate a file or line number. Therefore, findings are checked against the files that were actually provided to the model.

Unsupported findings are discarded instead of being displayed as if they were verified.

### Explainable retrieval

For the assessment's scale, I chose keyword-based retrieval in PostgreSQL instead of introducing a vector database.

The ranking considers:

* Terms extracted from the question.
* File paths.
* Term occurrences in file content.
* Review-specific keywords.
* Context budgets.

This keeps retrieval simple, deterministic and explainable while leaving a clear path toward `pg_trgm`, chunking or embeddings if the system grows.

### Secure repository ingestion

The uploaded ZIP is treated as hostile input.

The application does not simply extract the archive to disk. It validates paths, limits entries and sizes, rejects symlinks and binaries, filters likely secrets and stores accepted source text in the database.

### Context budgeting

Whole-project AI requests can easily exceed a model's context window. The application therefore explicitly limits the amount of source code supplied to the model and reports omitted/truncated files to the user.

### Next.js proxy

The frontend uses the Next.js origin as the browser-facing API boundary and proxies requests to NestJS.

This was chosen partly to make authentication cookies first-party and avoid unnecessary browser-side CORS complexity.

During testing, the default Next.js proxy body limit was also discovered to interfere with repository uploads, leading to an explicit proxy configuration and application-level upload limit.

---

## 7. How AI Output Was Verified

AI-generated suggestions were validated through several mechanisms.

### Automated tests

Tests cover:

* Authentication.
* Authorization and IDOR protection.
* ZIP traversal.
* ZIP bombs.
* Secret filtering.
* Structured AI output.
* AI retry behaviour.
* Provider/API failures.
* Encryption.
* Retrieval.
* Review flows.
* Chat.
* Diff review.
* Architecture analysis.
* Frontend behaviour.

### Static checks

The project also uses:

* TypeScript type checking.
* ESLint.
* Prettier.
* Frontend tests.
* Backend tests.
* Integration tests.

### Manual testing

The application was run end-to-end and tested through the browser, including:

* Authentication flows.
* Repository uploads.
* Code exploration.
* Reviews.
* Review history.
* Chat.
* Provider configuration.
* Diff review.
* Architecture analysis.
* Responsive behaviour.

### Real model testing

The system was also tested against a local Ollama model.

This was important because mocked AI responses can hide problems in prompts and model behaviour. Real-model testing exposed issues that were subsequently addressed through prompt revisions and post-processing.

---

## 8. Human-in-the-Loop Principle

A central principle of the project was:

> **AI can accelerate implementation, but it does not replace engineering judgment.**

I used AI to reduce the amount of time spent on repetitive implementation and debugging while spending engineering effort on:

* Understanding requirements.
* Choosing architecture.
* Evaluating trade-offs.
* Designing security boundaries.
* Testing failure modes.
* Validating AI behaviour.
* Reviewing generated implementations.
* Integrating components.
* Deciding what should and should not be added to the system.

This was particularly important for an AI-powered code-review application itself: the application treats AI output as untrusted data and applies deterministic validation and grounding before presenting it to users.

---

## 9. Summary

Claude and ChatGPT were significant productivity tools during development, but the project was developed through an iterative engineering process rather than a single prompt-to-application workflow.

The final implementation reflects deliberate decisions around architecture, security, AI reliability, context management, testing and user experience.

AI was most valuable for increasing development velocity and providing additional perspectives during implementation. The final system design, constraints, engineering trade-offs, validation strategy and acceptance of the resulting implementation remained subject to human review and testing.
