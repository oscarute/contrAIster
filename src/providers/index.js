import { gemini } from "./gemini.js";
import { anthropic } from "./anthropic.js";
import { openai } from "./openai.js";
import { openrouter } from "./openrouter.js";
import { deepseek, groq, mistral, ollama, perplexity, together, xai } from "./compat-providers.js";

// To add another AI: create a module with { id, keyEnv, envModel, suggested, local, listModels, ask } and register it here.
// OpenAI-compatible APIs are created with makeOpenAICompat (see compat-providers.js).
export const providers = Object.fromEntries(
  [gemini, anthropic, openai, xai, mistral, deepseek, groq, together, perplexity, openrouter, ollama].map((p) => [p.id, p])
);

export function getProvider(id) {
  const p = providers[id];
  if (!p) throw new Error(`Unknown provider "${id}". Available: ${Object.keys(providers).join(", ")}`);
  return p;
}
