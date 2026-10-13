import { getPref, loadConfig, setPref } from "./config.js";
import { providers } from "./providers/index.js";

const hasKey = (p) => p.keyEnv.some((k) => process.env[k]);

// Provider: argument > saved default > first one with a key configured > gemini
export function resolveProvider(id) {
  if (id) return id;
  const saved = loadConfig().defaultProvider;
  if (saved && providers[saved]) return saved;
  return Object.values(providers).find(hasKey)?.id ?? "gemini";
}

// Model: environment variable > saved preference. null if neither is set.
export const savedModel = (p) => process.env[p.envModel] || getPref(p.id) || null;

// First use without a preference: ask the user if the client supports elicitation. null otherwise.
export async function elicitModel(server, p) {
  if (!server.server.getClientCapabilities()?.elicitation) return null;
  try {
    const r = await server.server.elicitInput({
      message: `contrAIster: which ${p.id} model do you want to use to cross-check answers?`,
      requestedSchema: {
        type: "object",
        properties: {
          model: { type: "string", title: "Model ID", description: `Suggested: ${p.suggested}. Use list_models to see all of them.`, default: p.suggested },
          remember: { type: "boolean", title: "Remember as preferred", default: true },
        },
        required: ["model"],
      },
    });
    const model = r.action === "accept" ? r.content?.model?.trim() : "";
    if (!model) return null;
    if (r.content.remember !== false) setPref(p.id, model);
    return model;
  } catch {
    return null;
  }
}

export async function pickModel(server, p, explicit) {
  const model = explicit || savedModel(p) || (await elicitModel(server, p));
  if (model) return model;
  throw new Error(
    `No preferred model for ${p.id}. Ask the user which one they want (suggested: ${p.suggested}; ` +
      `use list_models to see the options) and save it with set_preferred_model, or pass it in the "model" parameter.`
  );
}
