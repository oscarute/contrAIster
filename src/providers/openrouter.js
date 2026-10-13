import { makeOpenAICompat } from "./openai-compat.js";

// OpenRouter da acceso a modelos de muchos proveedores con una sola clave. IDs con formato "proveedor/modelo".
export const openrouter = makeOpenAICompat({
  id: "openrouter",
  label: "OpenRouter",
  baseUrl: "https://openrouter.ai/api/v1",
  keyEnv: ["OPENROUTER_API_KEY"],
  envModel: "OPENROUTER_MODEL",
  suggested: "anthropic/claude-sonnet-4.5",
  filterModel: (m) => m.architecture?.output_modalities?.every((x) => x === "text") ?? true,
  mapModel: (m) => ({ id: m.id, displayName: m.name, inputTokenLimit: m.context_length }),
});
