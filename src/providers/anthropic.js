// Claude (Anthropic): its own API (/v1/messages), not OpenAI-compatible.
const BASE = "https://api.anthropic.com/v1";

function apiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY in the MCP server environment.");
  return key;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "x-api-key": apiKey(), "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint = res.status === 404 ? " Try another model: use list_models to see the available ones." : "";
    throw new Error(`Anthropic API ${res.status}: ${body?.error?.message ?? res.statusText}${hint}`);
  }
  return body;
}

export const anthropic = {
  id: "anthropic",
  keyEnv: ["ANTHROPIC_API_KEY"],
  envModel: "ANTHROPIC_MODEL",
  suggested: "claude-opus-5-5",
  local: false,

  async listModels() {
    const { data = [] } = await request("/models?limit=100");
    return data.map((m) => ({ id: m.id, displayName: m.display_name }));
  },

  async ask({ model, prompt, system, temperature, maxOutputTokens }) {
    if (!model) throw new Error("Missing model for Anthropic.");
    const body = {
      model,
      max_tokens: maxOutputTokens ?? 4096, // required by this API
      messages: [{ role: "user", content: prompt }],
      ...(system && { system }),
    };
    const send = (b) => request("/messages", { method: "POST", body: JSON.stringify(b) });
    const started = Date.now();
    let data;
    try {
      data = await send(temperature !== undefined ? { ...body, temperature } : body);
    } catch (e) {
      if (temperature === undefined || !/temperature/i.test(e.message)) throw e; // some models don't accept temperature
      data = await send(body);
    }
    const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
    if (!text) throw new Error(`Anthropic returned no text (${data.stop_reason ?? "no content"}).`);
    const u = data.usage;
    return {
      provider: "anthropic",
      model: data.model ?? model,
      text,
      finishReason: data.stop_reason,
      usage: u && { ...u, totalTokenCount: (u.input_tokens ?? 0) + (u.output_tokens ?? 0) },
      latencyMs: Date.now() - started,
    };
  },
};
