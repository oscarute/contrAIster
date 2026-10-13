import { gemini } from "./gemini.js";
import { anthropic } from "./anthropic.js";
import { openai } from "./openai.js";
import { openrouter } from "./openrouter.js";
import { deepseek, groq, mistral, ollama, perplexity, together, xai } from "./compat-providers.js";

// Para añadir otra IA: crear un módulo con { id, keyEnv, envModel, suggested, local, listModels, ask } y registrarlo aquí.
// Las APIs compatibles con OpenAI se crean con makeOpenAICompat (ver compat-providers.js).
export const providers = Object.fromEntries(
  [gemini, anthropic, openai, xai, mistral, deepseek, groq, together, perplexity, openrouter, ollama].map((p) => [p.id, p])
);

export function getProvider(id) {
  const p = providers[id];
  if (!p) throw new Error(`Proveedor desconocido "${id}". Disponibles: ${Object.keys(providers).join(", ")}`);
  return p;
}
