const BASE = "https://generativelanguage.googleapis.com/v1beta";

function apiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("Falta GEMINI_API_KEY en el entorno del servidor MCP.");
  return key;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "x-goog-api-key": apiKey(), "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Gemini API ${res.status}: ${body?.error?.message ?? res.statusText}`);
  }
  return body;
}

export const gemini = {
  id: "gemini",
  defaultModel: () => process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash",

  async listModels() {
    const { models = [] } = await request("/models?pageSize=200");
    return models
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => ({
        id: m.name.replace(/^models\//, ""),
        displayName: m.displayName,
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit,
      }));
  },

  async ask({ model, prompt, system, temperature, maxOutputTokens }) {
    const name = (model || this.defaultModel()).replace(/^models\//, "");
    const generationConfig = {};
    if (temperature !== undefined) generationConfig.temperature = temperature;
    if (maxOutputTokens !== undefined) generationConfig.maxOutputTokens = maxOutputTokens;

    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      ...(system && { systemInstruction: { parts: [{ text: system }] } }),
      ...(Object.keys(generationConfig).length && { generationConfig }),
    };
    const started = Date.now();
    const data = await request(`/models/${encodeURIComponent(name)}:generateContent`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    if (!text) {
      const reason = data.promptFeedback?.blockReason ?? candidate?.finishReason ?? "sin contenido";
      throw new Error(`Gemini no devolvió texto (${reason}).`);
    }
    return {
      provider: "gemini",
      model: name,
      text,
      finishReason: candidate?.finishReason,
      usage: data.usageMetadata,
      latencyMs: Date.now() - started,
    };
  },
};
