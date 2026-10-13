// Prueba de humo: arranca el servidor por stdio, lista las herramientas y comprueba la lógica de modelos sin red.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const env = { ...process.env, CONTRAISTER_CONFIG: join(mkdtempSync(join(tmpdir(), "contraister-")), "config.json") };
const client = new Client({ name: "smoke", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["src/index.js"], env }));

const { tools } = await client.listTools();
console.log("Tools:", tools.map((t) => t.name).join(", "));

const text = async (name, args = {}) => (await client.callTool({ name, arguments: args })).content[0].text;

console.log(await text("get_preferences"));

// Sin modelo preferido ni elicitation, cross_check debe pedir que se pregunte al usuario (sin llamar a la red).
const noPref = await client.callTool({ name: "cross_check", arguments: { question: "hola", answer: "hola", provider: "openai" } });
if (!noPref.isError || !/set_preferred_model/.test(noPref.content[0].text)) throw new Error("cross_check debería pedir modelo preferido");
console.log("OK: sin preferencia → pide modelo");

if (process.env.GEMINI_API_KEY) {
  console.log((await text("list_models", { provider: "gemini" })).split("\n").slice(0, 8).join("\n"));
}
await client.close();
