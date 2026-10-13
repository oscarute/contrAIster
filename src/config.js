import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

// Persistent preferences: { defaultProvider, models: { <provider>: "<model>" } }
export const configPath = () => process.env.CONTRAISTER_CONFIG || join(homedir(), ".contraister", "config.json");

export function loadConfig() {
  try {
    return JSON.parse(readFileSync(configPath(), "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  mkdirSync(dirname(configPath()), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
}

export const getPref = (provider) => loadConfig().models?.[provider];

export function setPref(provider, model) {
  const cfg = loadConfig();
  saveConfig({ ...cfg, models: { ...cfg.models, [provider]: model } });
}

export function setDefaultProvider(provider) {
  saveConfig({ ...loadConfig(), defaultProvider: provider });
}
