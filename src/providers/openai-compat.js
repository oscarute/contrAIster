// Proveedor genérico para cualquier API compatible con OpenAI (/chat/completions): OpenAI, OpenRouter, xAI, Mistral...
// keyEnv vacío = sin clave (p. ej. Ollama local). baseUrl puede ser una función (se evalúa en cada llamada).
// staticModels sustituye a GET /models en servicios que no lo ofrecen (Perplexity).
export function makeOpenAICompat({
  id, label, baseUrl, keyEnv, envModel, suggested, local = false, tokenParam = "max_tokens",
  skipTemperature, filterModel, mapModel, staticModels,
}) {
  const base = () => (typeof baseUrl === "function" ? baseUrl() : baseUrl);
  const apiKey = () => {
    if (!keyEnv.length) return null;
    const key = keyEnv.map((k) => process.env[k]).find(Boolean);
    if (!key) throw new Error(`Falta ${keyEnv[0]} en el entorno del servidor MCP.`);
    return key;
  };

  async function request(path, options = {}) {
    const key = apiKey();
    const res = await fetch(`${base()}${path}`, {
      ...options,
      headers: { ...(key && { Authorization: `Bearer ${key}` }), "Content-Type": "application/json" },
    }).catch((e) => {
      throw new Error(`No se pudo conectar con ${label} en ${base()}${local ? " (¿está arrancado?)" : ""}: ${e.cause?.code ?? e.message}`);
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const hint = res.status === 404 ? " Prueba con otro modelo: usa list_models para ver los disponibles." : "";
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
      const data = Array.isArray(body) ? body : body.data ?? []; // Together devuelve un array directo
      return data.filter(filterModel ?? (() => true)).map(mapModel ?? ((m) => ({ id: m.id })));
    },

    async ask({ model, prompt, system, temperature, maxOutputTokens }) {
      if (!model) throw new Error(`Falta el modelo para ${label}.`);
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
        if (!withTemp || !/temperature/i.test(e.message)) throw e; // algunos modelos no admiten temperature
        data = await chat(body);
      }
      const choice = data.choices?.[0];
      let text = choice?.message?.content;
      if (!text) throw new Error(`${label} no devolvió texto (${choice?.finish_reason ?? "sin contenido"}).`);
      if (data.citations?.length) text += `\n\nFuentes:\n${data.citations.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;
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
