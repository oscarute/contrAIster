// Generic provider for any OpenAI-compatible API (/chat/completions): OpenAI, OpenRouter, xAI, Mistral...
// Empty keyEnv = no key (e.g. local Ollama). baseUrl can be a function (evaluated on every call).
// staticModels replaces GET /models for services that don't offer it (Perplexity).
export function makeOpenAICompat({
  id, label, baseUrl, keyEnv, envModel, suggested, local = false, tokenParam = "max_tokens",
  skipTemperature, filterModel, mapModel, staticModels,
}) {
  const base = () => (typeof baseUrl === "function" ? baseUrl() : baseUrl);
  const apiKey = () => {
    if (!keyEnv.length) return null;
    const key = keyEnv.map((k) => process.env[k]).find(Boolean);
    if (!key) throw new Error(`Missing ${keyEnv[0]} in the MCP server environment.`);
    return key;
  };

  async function request(path, options = {}) {
    const key = apiKey();
    const res = await fetch(`${base()}${path}`, {
      ...options,
      headers: { ...(key && { Authorization: `Bearer ${key}` }), "Content-Type": "application/json" },
    }).catch((e) => {
      throw new Error(`Could not connect to ${label} at ${base()}${local ? " (is it running?)" : ""}: ${e.cause?.code ?? e.message}`);
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const hint = res.status === 404 ? " Try another model: use list_models to see the available ones." : "";
      const msg = body?.error?.message ?? (typeof body?.error === "string" ? body.error : null) ?? body?.message ?? res.statusText;
      throw new Error(`${label} API ${res.status}: ${msg}${hint}`);
    }
    return body;
  }

  const chat = (body) => request("/chat/completions", { method: "POST", body: JSON.stringify(body) });

  return {
    id,
    keyEnv,
    envModel,
    suggested,
    local,

    async listModels() {
      if (staticModels) return staticModels.map((m) => ({ id: m }));
      const body = await request("/models");
      const data = Array.isArray(body) ? body : body.data ?? []; // Together returns a bare array
      return data.filter(filterModel ?? (() => true)).map(mapModel ?? ((m) => ({ id: m.id })));
    },

    async ask({ model, prompt, system, temperature, maxOutputTokens }) {
      if (!model) throw new Error(`Missing model for ${label}.`);
      const body = {
        model,
        messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: prompt }],
        ...(maxOutputTokens !== undefined && { [tokenParam]: maxOutputTokens }),
      };
      const withTemp = temperature !== undefined && !skipTemperature?.test(model);
      const started = Date.now();
      let data;
      try {
        data = await chat(withTemp ? { ...body, temperature } : body);
      } catch (e) {
        if (!withTemp || !/temperature/i.test(e.message)) throw e; // some models don't accept temperature
        data = await chat(body);
      }
      const choice = data.choices?.[0];
      let text = choice?.message?.content;
      if (!text) throw new Error(`${label} returned no text (${choice?.finish_reason ?? "no content"}).`);
      if (data.citations?.length) text += `\n\nSources:\n${data.citations.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;
      return {
        provider: id,
        model: data.model ?? model,
        text,
        finishReason: choice.finish_reason,
        usage: data.usage && { ...data.usage, totalTokenCount: data.usage.total_tokens },
        latencyMs: Date.now() - started,
      };
    },
  };
}
