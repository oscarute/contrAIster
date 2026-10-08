import { gemini } from "./gemini.js";

// Para añadir otra IA: crear un módulo con { id, defaultModel, listModels, ask } y registrarlo aquí.
export const providers = { [gemini.id]: gemini };

export function getProvider(id) {
  const p = providers[id];
  if (!p) throw new Error(`Proveedor desconocido "${id}". Disponibles: ${Object.keys(providers).join(", ")}`);
  return p;
}
