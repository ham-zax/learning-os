/**
 * Provider-neutral LLM seam for Learning OS.
 *
 * Phase 0 deliberately ships without a provider implementation. Callers can
 * detect that state with isConfigured(); complete() fails explicitly instead
 * of depending on a sibling repository or provider SDK.
 */

// ---------------------------------------------------------------------------
// Public types
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
// Factory
// ---------------------------------------------------------------------------

export function createLLMClient(): LLMClient {
  return {
    isConfigured(): boolean {
      return false;
    },

    async complete(
      _prompt: string,
      _options?: CompletionOptions,
    ): Promise<string> {
      throw new Error("No LLM provider is configured for Learning OS.");
    },
  };
}
