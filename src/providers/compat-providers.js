import { makeOpenAICompat } from "./openai-compat.js";

// Modelos que no sirven para texto→texto (audio, voz, moderación, embeddings...)
const NON_CHAT = /(embed|tts|whisper|transcribe|moderation|guard|speech|rerank|image|vision-preview)/i;

export const xai = makeOpenAICompat({
  id: "xai",
  label: "xAI",
  baseUrl: "https://api.x.ai/v1",
  keyEnv: ["XAI_API_KEY"],
  envModel: "XAI_MODEL",
  suggested: "grok-4",
  filterModel: (m) => !NON_CHAT.test(m.id),
});

export const mistral = makeOpenAICompat({
  id: "mistral",
  label: "Mistral",
  baseUrl: "https://api.mistral.ai/v1",
  keyEnv: ["MISTRAL_API_KEY"],
  envModel: "MISTRAL_MODEL",
  suggested: "mistral-large-latest",
  filterModel: (m) => m.capabilities?.completion_chat ?? !NON_CHAT.test(m.id),
});

export const deepseek = makeOpenAICompat({
  id: "deepseek",
  label: "DeepSeek",
  baseUrl: "https://api.deepseek.com/v1",
  keyEnv: ["DEEPSEEK_API_KEY"],
  envModel: "DEEPSEEK_MODEL",
  suggested: "deepseek-reasoner",
});

export const groq = makeOpenAICompat({
  id: "groq",
  label: "Groq",
  baseUrl: "https://api.groq.com/openai/v1",
  keyEnv: ["GROQ_API_KEY"],
  envModel: "GROQ_MODEL",
  suggested: "llama-3.3-70b-versatile",
  tokenParam: "max_completion_tokens",
  filterModel: (m) => !NON_CHAT.test(m.id),
});

export const together = makeOpenAICompat({
  id: "together",
  label: "Together",
  baseUrl: "https://api.together.xyz/v1",
  keyEnv: ["TOGETHER_API_KEY"],
  envModel: "TOGETHER_MODEL",
  suggested: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  filterModel: (m) => !m.type || m.type === "chat",
  mapModel: (m) => ({ id: m.id, displayName: m.display_name, inputTokenLimit: m.context_length }),
});

// Perplexity no ofrece GET /models; sus respuestas incluyen búsqueda web y fuentes.
export const perplexity = makeOpenAICompat({
  id: "perplexity",
  label: "Perplexity",
  baseUrl: "https://api.perplexity.ai",
  keyEnv: ["PERPLEXITY_API_KEY"],
  envModel: "PERPLEXITY_MODEL",
  suggested: "sonar-pro",
  staticModels: ["sonar", "sonar-pro", "sonar-reasoning-pro", "sonar-deep-research"],
});

// Ollama local: sin clave. Cambia la dirección con OLLAMA_HOST (p. ej. http://192.168.1.10:11434).
export const ollama = makeOpenAICompat({
  id: "ollama",
  label: "Ollama",
  baseUrl: () => `${(process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "")}/v1`,
  keyEnv: [],
  envModel: "OLLAMA_MODEL",
  suggested: "llama3.2",
  local: true,
});
