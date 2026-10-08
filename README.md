# contrAIster

Servidor MCP para contrastar respuestas de una IA con otras (de momento Gemini).

## Herramientas
- `list_models`: modelos disponibles del proveedor.
- `ask_model`: pregunta a otra IA eligiendo `provider` y `model`.
- `cross_check`: revisa una respuesta (pregunta + respuesta) con otra IA; por defecto la otra IA responde primero de forma independiente.

## Uso
```
npm install
```
Clave de API en https://aistudio.google.com/apikey. Config MCP (Claude Desktop):
```json
{
  "mcpServers": {
    "contraister": {
      "command": "node",
      "args": ["C:/Users/chich/code/contrAIster/src/index.js"],
      "env": { "GEMINI_API_KEY": "TU_CLAVE" }
    }
  }
}
```
Claude Code:
```
claude mcp add contraister -e GEMINI_API_KEY=TU_CLAVE -- node C:/Users/chich/code/contrAIster/src/index.js
```

## Añadir otra IA
Crea `src/providers/<nombre>.js` con `{ id, defaultModel, listModels, ask }` y regístralo en `src/providers/index.js`.
