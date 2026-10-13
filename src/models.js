import { getPref, loadConfig, setPref } from "./config.js";
import { providers } from "./providers/index.js";

const hasKey = (p) => p.keyEnv.some((k) => process.env[k]);

// Proveedor: argumento > preferido guardado > primero con clave configurada > gemini
export function resolveProvider(id) {
  if (id) return id;
  const saved = loadConfig().defaultProvider;
  if (saved && providers[saved]) return saved;
  return Object.values(providers).find(hasKey)?.id ?? "gemini";
}

// Modelo: variable de entorno > preferencia guardada. null si no hay ninguno.
export const savedModel = (p) => process.env[p.envModel] || getPref(p.id) || null;

// Primer uso sin preferencia: pregunta al usuario si el cliente soporta "elicitation". null si no.
export async function elicitModel(server, p) {
  if (!server.server.getClientCapabilities()?.elicitation) return null;
  try {
    const r = await server.server.elicitInput({
      message: `contrAIster: ¿qué modelo de ${p.id} prefieres usar para contrastar respuestas?`,
      requestedSchema: {
        type: "object",
        properties: {
          model: { type: "string", title: "ID del modelo", description: `Sugerido: ${p.suggested}. Usa list_models para ver todos.`, default: p.suggested },
          remember: { type: "boolean", title: "Recordar como preferido", default: true },
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
    `No hay modelo preferido para ${p.id}. Pregunta al usuario cuál quiere (sugerido: ${p.suggested}; ` +
      `usa list_models para ver opciones) y guárdalo con set_preferred_model, o pásalo en el parámetro "model".`
  );
}
