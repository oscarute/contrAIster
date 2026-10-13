# contrAIster

An [MCP](https://modelcontextprotocol.io) server that cross-checks one AI's answer against other AI models. It works with any MCP client that can launch a local (stdio) server: Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, Codex CLI, Gemini CLI, Cline and others.

Supported providers: Gemini, Claude, OpenAI, xAI (Grok), Mistral, DeepSeek, Groq, Together, Perplexity, OpenRouter (hundreds of models with one key) and local Ollama. You bring your own API keys; they stay on your machine.

## Tools
- `cross_check`: reviews an answer (question + answer) with another AI, choosing `provider` and `model`. By default the other AI first answers independently, then compares.
- `list_models`: lists a provider's models (use `filter` to narrow down).
- `get_preferences` / `set_preferred_model`: view and save the preferred provider and model.

## Quick start

Requires [Node.js](https://nodejs.org) 18 or later. Nothing to install or clone: your MCP client runs the package from npm with `npx`.

Add this to your MCP client's configuration, with the keys of the providers you want to use (see [Providers and API keys](#providers-and-api-keys)):

```json
{
  "mcpServers": {
    "contraister": {
      "command": "npx",
      "args": ["-y", "contraister@latest"],
      "env": {
        "GEMINI_API_KEY": "YOUR_KEY",
        "OPENAI_API_KEY": "YOUR_KEY"
      }
    }
  }
}
```

The first start downloads the package and can take several seconds; later starts are faster. `@latest` makes `npx` check for new versions; pin a version (e.g. `contraister@0.2.0`) if you prefer.

### Claude Desktop: one-click install (.mcpb)

Download `contraister-<version>.mcpb` from the [latest release](https://github.com/oscarute/contrAIster/releases/latest) and open it with Claude Desktop (or drag it into Settings → Extensions). It asks for your API keys in a form (all optional; fill in only the providers you use) and needs no Node.js, JSON editing or terminal.

### Where to put it (manual configuration)

| Client | Where |
|---|---|
| Claude Desktop | `claude_desktop_config.json` (Settings → Developer → Edit Config) |
| Cursor | `~/.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Gemini CLI | `~/.gemini/settings.json` |

**Claude Code** (repeat `-e` for each key):
```
claude mcp add contraister -e GEMINI_API_KEY=YOUR_KEY -e OPENAI_API_KEY=YOUR_KEY -- npx -y contraister@latest
```

**VS Code** (`.vscode/mcp.json`; note the `servers` key and `type`):
```json
{
  "servers": {
    "contraister": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "contraister@latest"],
      "env": { "GEMINI_API_KEY": "YOUR_KEY" }
    }
  }
}
```

**Codex CLI** (`~/.codex/config.toml`):
```toml
[mcp_servers.contraister]
command = "npx"
args = ["-y", "contraister@latest"]
env = { GEMINI_API_KEY = "YOUR_KEY" }
```

Config locations and formats can change between client versions; check your client's MCP documentation if something differs. On Windows, if a client can't launch `npx` directly, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "contraister@latest"]`.

**ChatGPT (web/desktop apps)** only connects to *remote* MCP servers over HTTP, and contrAIster currently supports only local stdio, so it can't be added there yet. Clients that launch local servers (list above) work today.

## Providers and API keys
Only set the keys for the providers you will use.

| Provider (`provider`) | Key variable | Get a key |
|---|---|---|
| `gemini` | `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
| `anthropic` (Claude) | `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `openai` | `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `xai` (Grok) | `XAI_API_KEY` | https://console.x.ai |
| `mistral` | `MISTRAL_API_KEY` | https://console.mistral.ai |
| `deepseek` | `DEEPSEEK_API_KEY` | https://platform.deepseek.com |
| `groq` | `GROQ_API_KEY` | https://console.groq.com/keys |
| `together` | `TOGETHER_API_KEY` | https://api.together.xyz/settings/api-keys |
| `perplexity` | `PERPLEXITY_API_KEY` | https://www.perplexity.ai/settings/api (answers with web search and sources) |
| `openrouter` | `OPENROUTER_API_KEY` | https://openrouter.ai/keys (any `provider/model`) |
| `ollama` | none | https://ollama.com; optional `OLLAMA_HOST` (default `http://localhost:11434`) |

If `provider` is omitted, the saved default provider is used (`set_preferred_model` with `makeDefaultProvider`), otherwise the first provider that has a key configured.

## Choosing a model
Priority: `model` passed in the call (e.g. when the user asks for a specific model) > environment variable (`<PROVIDER>_MODEL`, e.g. `GEMINI_MODEL`, `ANTHROPIC_MODEL`, `OPENROUTER_MODEL`) > preference saved in `~/.contraister/config.json` (override the path with `CONTRAISTER_CONFIG`).

If none is set, the first call asks the user (if the MCP client supports elicitation) or tells the AI to ask the user and save the answer with `set_preferred_model`.

## Run from source
```
git clone https://github.com/oscarute/contrAIster.git
cd contrAIster
npm install
```
Then point your client to `node /path/to/contrAIster/src/index.js` instead of the `npx` command. On Windows PowerShell, if you get "running scripts is disabled", use `npm.cmd install`, run it from `cmd`, or allow scripts for your user with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Tests: `npm test` (no keys needed) and `npm run test:live` (calls each provider whose key is set in your environment).

## Adding another AI
If its API is OpenAI-compatible, add an entry like those in `src/providers/compat-providers.js` using `makeOpenAICompat`. Otherwise create `src/providers/<name>.js` exporting `{ id, keyEnv, envModel, suggested, listModels, ask }` (see `anthropic.js`). Either way, register it in `src/providers/index.js`.

## License
MIT
