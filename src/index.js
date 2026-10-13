#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { providers, getProvider } from "./providers/index.js";
import { configPath, loadConfig, setDefaultProvider, setPref } from "./config.js";
import { pickModel, resolveProvider, savedModel } from "./models.js";

const server = new McpServer({ name: "contraister", version: "0.2.0" });

const providerEnum = z.enum(Object.keys(providers)).optional().describe("Provider. If omitted, the saved default or the first one with an API key configured.");
const modelDesc =
  "Exact model ID. If the user names a specific model (e.g. \"use Gemini Pro\"), pass it here; " +
  "if you are unsure of the ID, look it up first with list_models (filter parameter). If omitted, the user's preferred model is used.";
const ok = (text) => ({ content: [{ type: "text", text }] });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] });

const formatResult = (r) =>
  `**${r.provider} / ${r.model}** (${r.latencyMs} ms${r.usage?.totalTokenCount ? `, ${r.usage.totalTokenCount} tokens` : ""})\n\n${r.text}`;

server.registerTool(
  "list_models",
  {
    description: "Lists the models available from an external AI provider (see get_preferences for the available providers). Use filter to narrow the list (e.g. \"claude\", \"pro\").",
    inputSchema: {
      provider: providerEnum,
      filter: z.string().optional().describe("Text the model ID or name must contain (case-insensitive)"),
    },
  },
  async ({ provider, filter }) => {
    try {
      const p = getProvider(resolveProvider(provider));
      const f = filter?.toLowerCase();
      const models = (await p.listModels()).filter((m) => !f || `${m.id} ${m.displayName ?? ""}`.toLowerCase().includes(f));
      if (!models.length) return ok(`No results in ${p.id}${filter ? ` for "${filter}"` : ""}.`);
      const shown = models.slice(0, 100);
      const more = models.length > shown.length ? `\n\n… and ${models.length - shown.length} more; narrow it down with filter.` : "";
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
      "Cross-checks a given answer (e.g. the one you just gave) with another AI: the second AI reviews it independently and points out errors, omissions and disagreements.",
    inputSchema: {
      question: z.string().describe("The original question"),
      answer: z.string().describe("The answer to cross-check"),
      provider: providerEnum,
      model: z.string().optional().describe(modelDesc),
      independent: z
        .boolean()
        .default(true)
        .describe("If true, the other AI first answers without seeing the answer and then compares (reduces anchoring bias)."),
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
        parts.push(`## Independent answer\n${formatResult(r)}`);
      }
      const review = await p.ask({
        model,
        temperature: 0.2,
        system: "You are a rigorous, critical reviewer. Respond in the language of the question.",
        prompt: [
          `QUESTION:\n${question}`,
          `ANSWER TO EVALUATE:\n${answer}`,
          independent ? `YOUR INDEPENDENT ANSWER:\n${ownAnswer}` : "",
          "Evaluate the answer: 1) points where it agrees, 2) errors or doubtful claims, 3) important omissions, 4) verdict (correct / partially correct / incorrect) with confidence high/medium/low.",
        ].filter(Boolean).join("\n\n"),
      });
      parts.push(`## Review\n${formatResult(review)}`);
      return ok(parts.join("\n\n---\n\n"));
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "get_preferences",
  {
    description: "Shows the configured preferred provider and models, and which providers have an API key. Use it before the first query to know whether the user must be asked for their preferred model.",
    inputSchema: {},
  },
  async () => {
    const cfg = loadConfig();
    const lines = Object.values(providers).map((p) => {
      const key = p.local ? "local, no key" : p.keyEnv.some((k) => process.env[k]) ? "key OK" : `no key (${p.keyEnv[0]})`;
      return `- ${p.id} [${key}]: model = ${savedModel(p) ?? `— (suggested: ${p.suggested})`}`;
    });
    return ok(`Preferred provider: ${resolveProvider()}${cfg.defaultProvider ? "" : " (automatic)"}\n${lines.join("\n")}\n\nConfig: ${configPath()}`);
  }
);

server.registerTool(
  "set_preferred_model",
  {
    description: "Saves a provider's preferred model for cross_check and optionally marks that provider as the default.",
    inputSchema: {
      provider: z.enum(Object.keys(providers)),
      model: z.string().describe("Exact model ID"),
      makeDefaultProvider: z.boolean().default(false).describe("Use this provider when none is specified"),
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
          const err = new Error(`"${model}" is not in ${provider}'s model list.${near.length ? ` Did you mean: ${near.join(", ")}?` : ""}`);
          err.notInList = true;
          throw err;
        }
      } catch (e) {
        if (e.notInList) throw e;
        note = ` (could not validate against the model list: ${e.message})`;
      }
      setPref(provider, model);
      if (makeDefaultProvider) setDefaultProvider(provider);
      return ok(`Saved: ${provider} = ${model}${makeDefaultProvider ? " (default provider)" : ""}${note}`);
    } catch (e) {
      return fail(e);
    }
  }
);

await server.connect(new StdioServerTransport());
