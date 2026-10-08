#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { providers, getProvider } from "./providers/index.js";

const server = new McpServer({ name: "contraister", version: "0.1.0" });

const providerEnum = z.enum(Object.keys(providers));
const ok = (text) => ({ content: [{ type: "text", text }] });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] });

const formatResult = (r) =>
  `**${r.provider} / ${r.model}** (${r.latencyMs} ms${r.usage?.totalTokenCount ? `, ${r.usage.totalTokenCount} tokens` : ""})\n\n${r.text}`;

server.registerTool(
  "list_models",
  {
    description: "Lista los modelos disponibles de un proveedor de IA externo (p. ej. gemini).",
    inputSchema: { provider: providerEnum.default("gemini") },
  },
  async ({ provider }) => {
    try {
      const models = await getProvider(provider).listModels();
      return ok(models.map((m) => `- ${m.id}${m.displayName ? ` (${m.displayName})` : ""}`).join("\n"));
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "ask_model",
  {
    description: "Envía un prompt a otra IA y devuelve su respuesta, eligiendo proveedor y modelo concreto.",
    inputSchema: {
      prompt: z.string().describe("Pregunta o prompt a enviar"),
      provider: providerEnum.default("gemini"),
      model: z.string().optional().describe("ID exacto del modelo (ver list_models). Si se omite, el modelo por defecto."),
      system: z.string().optional().describe("Instrucción de sistema opcional"),
      temperature: z.number().min(0).max(2).optional(),
      maxOutputTokens: z.number().int().positive().optional(),
    },
  },
  async ({ provider, ...args }) => {
    try {
      return ok(formatResult(await getProvider(provider).ask(args)));
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
      provider: providerEnum.default("gemini"),
      model: z.string().optional(),
      independent: z
        .boolean()
        .default(true)
        .describe("Si true, la otra IA responde primero sin ver la respuesta y luego se compara (reduce sesgo de anclaje)."),
    },
  },
  async ({ question, answer, provider, model, independent }) => {
    try {
      const p = getProvider(provider);
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

await server.connect(new StdioServerTransport());
