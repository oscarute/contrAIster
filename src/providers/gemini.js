// Models that are not text-to-text (image, audio, agents, etc.)
const NON_TEXT = /(tts|image|lyria|robotics|computer-use|transcribe|antigravity|deep-research|omni|nano-banana|embedding|aqa)/i;
const BASE = "https://generativelanguage.googleapis.com/v1beta";

function apiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY in the MCP server environment.");
  return key;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "x-goog-api-key": apiKey(), "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint = res.status === 404 ? " Try another model: use list_models to see the available ones." : "";
    throw new Error(`Gemini API ${res.status}: ${body?.error?.message ?? res.statusText}${hint}`);
  }
  return body;
}

export const gemini = {
  id: "gemini",
  keyEnv: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  envModel: "GEMINI_MODEL",
  suggested: "gemini-3.1-pro-preview",

  async listModels() {
    const { models = [] } = await request("/models?pageSize=200");
    return models
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent") && !NON_TEXT.test(m.name))
      .map((m) => ({
        id: m.name.replace(/^models\//, ""),
        displayName: m.displayName,
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit,
      }));
  },

  async ask({ model, prompt, system, temperature, maxOutputTokens }) {
    if (!model) throw new Error("Missing model for Gemini.");
    const name = model.replace(/^models\//, "");
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
      const reason = data.promptFeedback?.blockReason ?? candidate?.finishReason ?? "no content";
      throw new Error(`Gemini returned no text (${reason}).`);
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
