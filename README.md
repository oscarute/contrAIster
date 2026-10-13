# contrAIster

Servidor MCP para contrastar las respuestas de una IA con las de otras: Gemini, Claude, OpenAI, Grok, Mistral, DeepSeek, Groq, Together, Perplexity, OpenRouter (cientos de modelos con una sola clave) y Ollama local.

## Herramientas
- `list_models`: modelos disponibles de un proveedor (con `filter` para acotar).
- `cross_check`: revisa una respuesta (pregunta + respuesta) con otra IA, eligiendo `provider` y `model`; por defecto la otra IA responde primero de forma independiente.
- `get_preferences` / `set_preferred_model`: ver y guardar el proveedor y el modelo preferido de cada uno.

## Proveedores y claves
Solo necesitas la clave de los proveedores que vayas a usar.

| Proveedor (`provider`) | Variable de clave | Dónde obtenerla |
|---|---|---|
| `gemini` | `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
| `anthropic` (Claude) | `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `openai` | `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `xai` (Grok) | `XAI_API_KEY` | https://console.x.ai |
| `mistral` | `MISTRAL_API_KEY` | https://console.mistral.ai |
| `deepseek` | `DEEPSEEK_API_KEY` | https://platform.deepseek.com |
| `groq` | `GROQ_API_KEY` | https://console.groq.com/keys |
| `together` | `TOGETHER_API_KEY` | https://api.together.xyz/settings/api-keys |
| `perplexity` | `PERPLEXITY_API_KEY` | https://www.perplexity.ai/settings/api (respuestas con búsqueda web y fuentes) |
| `openrouter` | `OPENROUTER_API_KEY` | https://openrouter.ai/keys (cualquier modelo `proveedor/modelo`) |
| `ollama` | ninguna | https://ollama.com; `OLLAMA_HOST` opcional (por defecto `http://localhost:11434`) |

Si no indicas `provider`, se usa el guardado como preferido (`set_preferred_model` con `makeDefaultProvider`) o, si no hay, el primero con clave configurada.

## Elección de modelo
Orden de prioridad: `model` indicado en la llamada (p. ej. si el usuario pide un modelo concreto) > variable de entorno (`<PROVEEDOR>_MODEL`, p. ej. `GEMINI_MODEL`, `ANTHROPIC_MODEL`, `OPENROUTER_MODEL`) > preferencia guardada en `~/.contraister/config.json` (cambiable con `CONTRAISTER_CONFIG`).
Si no hay ninguna, en el primer uso se pregunta al usuario (si el cliente MCP lo soporta) o se le pide a la IA que lo pregunte y lo guarde con `set_preferred_model`.

## Uso
```
npm install
```
Config MCP (Claude Desktop y la mayoría de clientes). Incluye solo las claves que tengas:
```json
{
  "mcpServers": {
    "contraister": {
      "command": "node",
      "args": ["RUTA/contrAIster/src/index.js"],
      "env": {
        "GEMINI_API_KEY": "TU_CLAVE",
        "ANTHROPIC_API_KEY": "TU_CLAVE",
        "OPENAI_API_KEY": "TU_CLAVE",
        "OPENROUTER_API_KEY": "TU_CLAVE"
      }
    }
  }
}
```
Claude Code (repite `-e` por cada clave):
```
claude mcp add contraister -e GEMINI_API_KEY=TU_CLAVE -e OPENAI_API_KEY=TU_CLAVE -- node RUTA/contrAIster/src/index.js
```
Sustituye `RUTA` por la carpeta donde tengas el proyecto.

## Añadir otra IA
Si su API es compatible con OpenAI, basta una entrada como las de `src/providers/compat-providers.js` usando `makeOpenAICompat`. Si no, crea `src/providers/<nombre>.js` con `{ id, keyEnv, envModel, suggested, listModels, ask }` (ver `anthropic.js`). En ambos casos, regístralo en `src/providers/index.js`.
