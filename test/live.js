// Live test: for each provider with an API key set (and Ollama if reachable), lists models and makes one tiny request.
// Usage: set the key env vars (e.g. $env:OPENAI_API_KEY="...") and run `npm run test:live`. Nothing is printed except model IDs and results.
import { providers } from "../src/providers/index.js";
import { savedModel } from "../src/models.js";

const only = process.argv.slice(2);
let failed = 0;

for (const p of Object.values(providers)) {
  if (only.length && !only.includes(p.id)) continue;
  if (!p.local && !p.keyEnv.some((k) => process.env[k])) {
    console.log(`SKIP  ${p.id} (no ${p.keyEnv[0]})`);
    continue;
  }
  let models = [];
  try {
    models = await p.listModels();
    console.log(`OK    ${p.id} list_models: ${models.length} models`);
  } catch (e) {
    if (p.local) {
      console.log(`SKIP  ${p.id} (${e.message})`);
      continue;
    }
    failed++;
    console.log(`FAIL  ${p.id} list_models: ${e.message}`);
  }

  const model = savedModel(p) ?? (models.some((m) => m.id === p.suggested) ? p.suggested : p.local ? models[0]?.id : p.suggested);
  if (models.length && !models.some((m) => m.id === p.suggested) && !savedModel(p) && !p.local) {
    console.log(`WARN  ${p.id}: suggested model "${p.suggested}" is not in the list`);
  }
  try {
    const r = await p.ask({ model, prompt: "Reply with the single word: pong", maxOutputTokens: 1024 });
    console.log(`OK    ${p.id} ask (${r.model}, ${r.latencyMs} ms): ${r.text.trim().slice(0, 60).replace(/\s+/g, " ")}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${p.id} ask (${model}): ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
