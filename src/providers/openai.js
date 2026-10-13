import { makeOpenAICompat } from "./openai-compat.js";

// Modelos que no sirven para texto→texto (embeddings, audio, imagen, moderación...)
const NON_TEXT = /(embedding|tts|whisper|dall-e|image|moderation|audio|realtime|transcribe|sora|search-preview|codex)/i;

export const openai = makeOpenAICompat({
  id: "openai",
  label: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
  keyEnv: ["OPENAI_API_KEY"],
  envModel: "OPENAI_MODEL",
  suggested: "gpt-5",
  tokenParam: "max_completion_tokens",
  skipTemperature: /^(o\d|gpt-5)/i, // los modelos de razonamiento rechazan temperature
  filterModel: (m) => /^(gpt|o\d|chatgpt)/i.test(m.id) && !NON_TEXT.test(m.id),
});
