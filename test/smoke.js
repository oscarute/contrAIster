// Prueba de humo: arranca el servidor por stdio y lista las herramientas.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "smoke", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["src/index.js"], env: process.env }));
const { tools } = await client.listTools();
console.log("Tools:", tools.map((t) => t.name).join(", "));

if (process.env.GEMINI_API_KEY) {
  const r = await client.callTool({ name: "list_models", arguments: { provider: "gemini" } });
  console.log(r.content[0].text.split("\n").slice(0, 8).join("\n"));
}
await client.close();
