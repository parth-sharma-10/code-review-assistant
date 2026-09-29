# Decision: one OpenAI-compatible client behind a one-method interface

## Problem

Users choose their own model: OpenAI in the cloud, or a local model through LM Studio or Ollama, or a
router such as OpenRouter. Provider details must not spread through controllers and services, and
configuration (URL, key, model) must come from users or the environment, never from code.

## Alternatives

| Option | For | Against |
|---|---|---|
| Official vendor SDKs, one per provider | Typed clients, vendor features | Four dependencies doing the same HTTP call; still need a common interface on top |
| A class hierarchy (`AIProvider` → `OpenAIProvider`, `OpenAICompatibleProvider`, `OllamaProvider`, ...) | Mirrors the brief literally | Every subclass would be the same `POST /chat/completions` with a different default URL |
| A framework (LangChain etc.) | Batteries included | A large dependency and abstraction for four HTTP calls; harder to explain and debug |
| **One `fetch`-based client implementing a `ChatModel` interface** | Tiny; the same code path for every provider; trivially testable | Vendor-specific features (native structured output, streaming) are not used |

## Evidence

- **Ollama** documents OpenAI compatibility at `http://localhost:11434/v1/`, with `/v1/chat/completions`
  supported, and describes the API key as "required but ignored" for local servers.
  https://docs.ollama.com/api/openai-compatibility
- **LM Studio** serves `http://localhost:1234/v1` with `/v1/chat/completions`, and says you can "reuse
  existing OpenAI clients … by switching up the 'base URL' property".
  https://lmstudio.ai/docs/app/api/endpoints/openai
- **OpenRouter** uses base URL `https://openrouter.ai/api/v1` with the key as a bearer token.
  https://openrouter.ai/docs/quickstart
- **Structured-output support differs between servers.** LM Studio supports `response_format` with
  `"type": "json_schema"` and does not document `json_object`.
  https://lmstudio.ai/docs/app/api/structured-output
- **Sampling parameters differ between models.** OpenAI reasoning models reject `temperature`
  ("Unsupported parameter: 'temperature' is not supported with this model").
  https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning ·
  https://community.openai.com/t/o3-mini-unsupported-parameter-temperature/1140846
- **Verified in this project** against Ollama 0.34.4 with `qwen2.5-coder:7b`: connection test,
  single-file and whole-project reviews, chat, diff review and architecture analysis all completed
  through the same client.

## Decision

```ts
interface ChatModel { complete(messages: ChatMessage[]): Promise<string> }
class OpenAICompatibleChatModel implements ChatModel   // POST {baseUrl}/chat/completions
```

- The application's AI operations (`generateReview`, `generateDiffReview`,
  `generateArchitectureAnalysis`, `chat`) live in `AiService` and depend only on `ChatModel`. They
  contain all the prompt building and validation logic and know nothing about vendors.
- The provider `type` enum (`OPENAI`, `LM_STUDIO`, `OLLAMA`, `OPENROUTER`, `CUSTOM`) drives UI
  presets only.
- The request body is `{ model, messages }` and nothing else. No `temperature` and no
  `response_format`, because either one breaks at least one supported provider. Structure is enforced
  by validation instead (see `ai-output-validation.md`).
- Provider settings are per user, with the API key encrypted using AES-256-GCM. An optional
  environment fallback (`OPENAI_BASE_URL/API_KEY/MODEL`) covers deployments where the operator supplies
  the model.

## Tradeoffs

- **The interface has one production implementation.** It is kept because tests substitute scripted
  models through it, and because a non-OpenAI protocol (such as Anthropic's Messages API) would be a
  second class without changing any caller.
- **Deterministic sampling is given up** (no `temperature: 0`), so reviews vary between runs. Where a
  provider supports it, a per-provider "extra parameters" field would be the next step.
- **Provider-native structured output is not used,** even where it would improve the first-attempt
  success rate. It could be added per provider later, with validation kept as the backstop.
- **User-controlled base URLs are an SSRF surface** (see SECURITY.md). This is the price of supporting
  localhost model servers.
