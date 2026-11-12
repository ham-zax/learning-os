import { spawnSync } from "node:child_process";
import { compiledPackageProblems } from "./package-artifacts.mjs";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const packed = spawnSync(npm, ["pack", "--dry-run", "--ignore-scripts", "--json"], { encoding: "utf8" });
if (packed.status !== 0) throw new Error(`Package inspection failed: ${packed.stderr}`);
const result = JSON.parse(packed.stdout);
const packages = Array.isArray(result) ? result : Object.values(result);
const files = packages.flatMap((entry) => entry.files.map((file) => file.path));
const tracked = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });
if (tracked.status !== 0) throw new Error("Package privacy verification requires the source Git checkout.");
const { unexpected, missing } = compiledPackageProblems(files, tracked.stdout.split("\0").filter(Boolean));
if (unexpected.length || missing.length) {
  throw new Error([
    ...unexpected.map((path) => `Unexpected compiled artifact without tracked source: ${path}`),
    ...missing.map((path) => `Missing compiled artifact (run npm run build): ${path}`),
  ].join("\n"));
}
const publicSources = new Set(tracked.stdout.split("\0"));
const forbidden = files.filter((path) =>
  /(^|\/)(data|state|plans|specs|\.env[^/]*|config\.json)(\/|$)/i.test(path)
  || /\.(db|sqlite|sqlite3)(-|$)/i.test(path)
  || /behavioral-prep\.md$/.test(path)
  || (!path.startsWith("dist/") && !publicSources.has(path)));
if (forbidden.length) throw new Error(`Private or unreviewed files included in package:\n${forbidden.join("\n")}`);
for (const required of ["dist/cli.js", "dist/kernel-cli.js", "knowledge/backend-systems/manifest.json", "knowledge/frontend-revision/manifest.json"]) {
  if (!files.includes(required)) throw new Error(`Required package file is missing: ${required}`);
}
console.log(`Package privacy check passed (${files.length} files; no learner state or unreviewed sources).`);
