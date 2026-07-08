/**
 * LLM client — backed by Nexus's OpenAI-compatible client.
 *
 * Supports any OpenAI-compatible endpoint (DeepSeek, OpenAI, Ollama, etc.)
 * via LLM_ENDPOINT / LLM_MODEL / LLM_API_KEY env vars.
 * Falls back to Anthropic-specific vars (ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY,
 * ANTHROPIC_MODEL) for backward compatibility.
 */

import { createLLMClient as createNexusClient } from "nexus/llm";
import type { LLMClient as NexusLLMClient } from "nexus/llm";

// ---------------------------------------------------------------------------
// Public types — unchanged from original, callers don't need to know about Nexus
// ---------------------------------------------------------------------------

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMClient {
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  /** Check if the client has enough config to make LLM calls. */
  isConfigured(): boolean;
}

// ---------------------------------------------------------------------------
// Config resolution
// ---------------------------------------------------------------------------

interface ResolvedConfig {
  endpoint: string;
  model: string;
  apiKey: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_RETRIES = 3;

function resolveConfig(overrides?: Partial<ResolvedConfig>): ResolvedConfig {
  // Nexus vars take precedence, then Anthropic legacy vars
  const endpoint =
    overrides?.endpoint ??
    process.env.LLM_ENDPOINT ??
    process.env.ANTHROPIC_BASE_URL ??
    "";

  const model =
    overrides?.model ??
    process.env.LLM_MODEL ??
    process.env.ANTHROPIC_MODEL ??
    DEFAULT_MODEL;

  const apiKey =
    overrides?.apiKey ??
    process.env.LLM_API_KEY ??
    process.env.ANTHROPIC_API_KEY ??
    "";

  if (!endpoint && !apiKey) {
    throw new Error(
      "No LLM configured. Set one of:\n" +
        "  - LLM_ENDPOINT + LLM_API_KEY (any OpenAI-compatible provider)\n" +
        "  - ANTHROPIC_API_KEY (Anthropic default endpoint)\n"
    );
  }

  // If only Anthropic key is set (no explicit endpoint), use Anthropic's endpoint
  const resolvedEndpoint =
    endpoint || "https://api.anthropic.com/v1";

  return { endpoint: resolvedEndpoint, model, apiKey };
}

// ---------------------------------------------------------------------------
// Adapter — wraps Nexus LLMClient to match generic-tutor's simple interface
// ---------------------------------------------------------------------------

function adaptNexusClient(nexus: NexusLLMClient): LLMClient {
  return {
    isConfigured(): boolean {
      return nexus.isConfigured();
    },

    async complete(
      prompt: string,
      options?: CompletionOptions
    ): Promise<string> {
      const messages: Array<{ role: "system" | "user"; content: string }> = [];

      if (options?.systemPrompt) {
        messages.push({ role: "system", content: options.systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const response = await nexus.complete({
        messages,
        model: options?.model,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens ?? 4096,
      });

      return response.choices[0]?.message?.content ?? "";
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an LLM client instance.
 *
 * Config resolution order:
 * 1. Explicit overrides passed to this function
 * 2. LLM_ENDPOINT / LLM_MODEL / LLM_API_KEY (Nexus convention)
 * 3. ANTHROPIC_BASE_URL / ANTHROPIC_MODEL / ANTHROPIC_API_KEY (legacy)
 *
 * @example
 * ```ts
 * // Use env vars (LLM_* or ANTHROPIC_*)
 * const client = createLLMClient();
 *
 * // Explicit config
 * const client = createLLMClient({ endpoint: "https://api.deepseek.com/v1" });
 * ```
 */
export function createLLMClient(
  config?: Partial<ResolvedConfig>
): LLMClient {
  const resolved = resolveConfig(config);

  const nexus = createNexusClient({
    endpoint: resolved.endpoint,
    model: resolved.model,
    apiKey: resolved.apiKey,
    maxRetries: DEFAULT_MAX_RETRIES,
  });

  return adaptNexusClient(nexus);
}
