#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { providers, getProvider } from "./providers/index.js";
import { configPath, loadConfig, setDefaultProvider, setPref } from "./config.js";
import { pickModel, resolveProvider, savedModel } from "./models.js";

const server = new McpServer({ name: "contraister", version: "0.2.0" });

const providerEnum = z.enum(Object.keys(providers)).optional().describe("Proveedor. Si se omite, el preferido o el primero con clave configurada.");
const modelDesc =
  "ID exacto del modelo. Si el usuario nombra un modelo concreto (p. ej. \"usa Gemini Pro\"), pásalo aquí; " +
  "si no estás seguro del ID, búscalo antes con list_models (parámetro filter). Si se omite, el modelo preferido del usuario.";
const ok = (text) => ({ content: [{ type: "text", text }] });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] });

const formatResult = (r) =>
  `**${r.provider} / ${r.model}** (${r.latencyMs} ms${r.usage?.totalTokenCount ? `, ${r.usage.totalTokenCount} tokens` : ""})\n\n${r.text}`;

server.registerTool(
  "list_models",
  {
    description: "Lista los modelos disponibles de un proveedor de IA externo (ver get_preferences para los disponibles). Usa filter para acotar (p. ej. \"claude\", \"pro\").",
    inputSchema: {
      provider: providerEnum,
      filter: z.string().optional().describe("Texto que debe contener el ID o nombre del modelo (sin distinguir mayúsculas)"),
    },
  },
  async ({ provider, filter }) => {
    try {
      const p = getProvider(resolveProvider(provider));
      const f = filter?.toLowerCase();
      const models = (await p.listModels()).filter((m) => !f || `${m.id} ${m.displayName ?? ""}`.toLowerCase().includes(f));
      if (!models.length) return ok(`Sin resultados en ${p.id}${filter ? ` para "${filter}"` : ""}.`);
      const shown = models.slice(0, 100);
      const more = models.length > shown.length ? `\n\n… y ${models.length - shown.length} más; afina con filter.` : "";
      return ok(shown.map((m) => `- ${m.id}${m.displayName ? ` (${m.displayName})` : ""}`).join("\n") + more);
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "cross_check",
  {
    description:
      "Contrasta una respuesta dada (p. ej. la de Claude) con otra IA: la segunda IA la revisa de forma independiente y señala errores, omisiones y discrepancias.",
    inputSchema: {
      question: z.string().describe("La pregunta original"),
      answer: z.string().describe("La respuesta a contrastar"),
      provider: providerEnum,
      model: z.string().optional().describe(modelDesc),
      independent: z
        .boolean()
        .default(true)
        .describe("Si true, la otra IA responde primero sin ver la respuesta y luego se compara (reduce sesgo de anclaje)."),
    },
  },
  async ({ question, answer, provider, model, independent }) => {
    try {
      const p = getProvider(resolveProvider(provider));
      model = await pickModel(server, p, model);
      const parts = [];
      let ownAnswer = "";
      if (independent) {
        const r = await p.ask({ model, prompt: question });
        ownAnswer = r.text;
        parts.push(`## Respuesta independiente\n${formatResult(r)}`);
      }
      const review = await p.ask({
        model,
        temperature: 0.2,
        system: "Eres un revisor crítico y riguroso. Responde en el idioma de la pregunta.",
        prompt: [
          `PREGUNTA:\n${question}`,
          `RESPUESTA A EVALUAR:\n${answer}`,
          independent ? `TU RESPUESTA INDEPENDIENTE:\n${ownAnswer}` : "",
          "Evalúa la respuesta: 1) puntos en que coincide, 2) errores o afirmaciones dudosas, 3) omisiones importantes, 4) veredicto (correcta / parcialmente correcta / incorrecta) con confianza alta/media/baja.",
        ].filter(Boolean).join("\n\n"),
      });
      parts.push(`## Revisión\n${formatResult(review)}`);
      return ok(parts.join("\n\n---\n\n"));
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "get_preferences",
  {
    description: "Muestra el proveedor y los modelos preferidos configurados, y qué proveedores tienen clave de API. Úsalo antes de la primera consulta para saber si hay que preguntar al usuario su modelo preferido.",
    inputSchema: {},
  },
  async () => {
    const cfg = loadConfig();
    const lines = Object.values(providers).map((p) => {
      const key = p.local ? "local, sin clave" : p.keyEnv.some((k) => process.env[k]) ? "clave OK" : `sin clave (${p.keyEnv[0]})`;
      return `- ${p.id} [${key}]: modelo = ${savedModel(p) ?? `— (sugerido: ${p.suggested})`}`;
    });
    return ok(`Proveedor preferido: ${resolveProvider()}${cfg.defaultProvider ? "" : " (automático)"}\n${lines.join("\n")}\n\nConfig: ${configPath()}`);
  }
);

server.registerTool(
  "set_preferred_model",
  {
    description: "Guarda el modelo preferido de un proveedor para cross_check y opcionalmente lo marca como proveedor por defecto.",
    inputSchema: {
      provider: z.enum(Object.keys(providers)),
      model: z.string().describe("ID exacto del modelo"),
      makeDefaultProvider: z.boolean().default(false).describe("Usar este proveedor cuando no se indique ninguno"),
    },
  },
  async ({ provider, model, makeDefaultProvider }) => {
    try {
      const p = getProvider(provider);
      let note = "";
      try {
        const known = await p.listModels();
        if (!known.some((m) => m.id === model)) {
          const near = known.filter((m) => m.id.toLowerCase().includes(model.toLowerCase())).slice(0, 8).map((m) => m.id);
          throw new Error(`"${model}" no está en la lista de ${provider}.${near.length ? ` ¿Quizá: ${near.join(", ")}?` : ""}`);
        }
      } catch (e) {
        if (e.message.includes("no está en la lista")) throw e;
        note = ` (no se pudo validar contra la lista: ${e.message})`;
      }
      setPref(provider, model);
      if (makeDefaultProvider) setDefaultProvider(provider);
      return ok(`Guardado: ${provider} = ${model}${makeDefaultProvider ? " (proveedor por defecto)" : ""}${note}`);
    } catch (e) {
      return fail(e);
    }
  }
);

await server.connect(new StdioServerTransport());
