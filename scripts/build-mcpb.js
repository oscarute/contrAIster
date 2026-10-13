// Builds build/contraister-<version>.mcpb (Claude Desktop extension) from src/ and mcpb/manifest.json.
// Usage: npm run build:mcpb
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const stage = join(root, "build", "mcpb");
const out = join(root, "build", `contraister-${pkg.version}.mcpb`);
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: "inherit" });

// Retries help on Windows when a sync client (e.g. Dropbox) briefly locks files in build/
rmSync(join(root, "build"), { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
mkdirSync(stage, { recursive: true });

// Server code + a minimal package.json (ESM + production dependencies) so node_modules can be bundled.
cpSync(join(root, "src"), join(stage, "server"), { recursive: true });
writeFileSync(
  join(stage, "package.json"),
  JSON.stringify({ name: pkg.name, version: pkg.version, type: "module", private: true, dependencies: pkg.dependencies }, null, 2)
);
cpSync(join(root, "LICENSE"), join(stage, "LICENSE"));

// Manifest with the version taken from package.json
const manifest = JSON.parse(readFileSync(join(root, "mcpb", "manifest.json"), "utf8"));
manifest.version = pkg.version;
writeFileSync(join(stage, "manifest.json"), JSON.stringify(manifest, null, 2));

run("npm install --omit=dev --no-audit --no-fund --no-package-lock", stage);
run(`npx -y @anthropic-ai/mcpb validate "${stage}"`);
run(`npx -y @anthropic-ai/mcpb pack "${stage}" "${out}"`);
console.log(`\nBuilt ${out}`);
