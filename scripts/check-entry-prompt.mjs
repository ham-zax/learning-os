import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DOC = "docs/agent-web-session-instructions.md";
const MAX_PROMPT_LINES = 3;
const MAX_CLI_ENTRY_WORDS = 400;
const MAX_CLI_ENTRY_BYTES = 3400;
const MAX_MCP_ADVERTISED_WORDS = 600;
const MAX_MCP_CATALOG_BYTES = 16384;

function countWords(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

function stripFrontmatter(raw) {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/u, "").trim();
}

function extractEntryRefs(filePath, content) {
  const refs = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    const importMatch = trimmed.match(/^@([^\s]+)$/u);
    if (importMatch) {
      refs.push(resolve(dirname(filePath), importMatch[1]));
    }
  }
  // Follow backticked or markdown-linked local .md files explicitly named in entry docs
  for (const match of content.matchAll(/(?:\]\(|`)((?:\.\.?\/)?[A-Za-z0-9_./-]+\.md)(?:\)|`)/gu)) {
    const rel = match[1];
    if (rel.startsWith("http")) continue;
    refs.push(resolve(dirname(filePath), rel));
  }
  return refs;
}

function walkMandatoryGraph(entryFiles) {
  const root = resolve(".");
  const visited = new Set();
  const stack = new Set();
  const files = [];

  function visit(absPath) {
    if (stack.has(absPath)) {
      throw new Error(`Cycle detected in mandatory entry instructions: ${absPath}`);
    }
    if (visited.has(absPath)) return;
    if (!existsSync(absPath)) {
      throw new Error(`Mandatory entry target is missing: ${absPath}`);
    }
    visited.add(absPath);
    stack.add(absPath);
    const content = readFileSync(absPath, "utf8");
    files.push({
      path: absPath.startsWith(`${root}/`) ? absPath.slice(root.length + 1) : absPath,
      words: countWords(content),
      bytes: Buffer.byteLength(content, "utf8"),
    });
    for (const ref of extractEntryRefs(absPath, content)) {
      if (ref.startsWith(`${root}/`)) {
        visit(ref);
      }
    }
    stack.delete(absPath);
  }

  for (const file of entryFiles) {
    visit(resolve(file));
  }
  return files;
}

function checkStarterPrompt() {
  const doc = readFileSync(DOC, "utf8");
  const sectionStart = doc.indexOf("## Starter prompt");
  if (sectionStart === -1) {
    throw new Error(`${DOC}: missing "## Starter prompt" section.`);
  }
  const sectionEnd = doc.indexOf("\n## ", sectionStart + 1);
  const section = doc.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd);
  const block = section.match(/```text\n([\s\S]*?)```/);
  if (!block) {
    throw new Error(`${DOC}: starter prompt has no \`\`\`text block.`);
  }
  const lines = block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > MAX_PROMPT_LINES) {
    throw new Error(`${DOC}: starter prompt is ${lines.length} lines, limit is ${MAX_PROMPT_LINES}.`);
  }
  if (!lines.some((line) => line.includes("AGENTS.md"))) {
    throw new Error(`${DOC}: starter prompt must name AGENTS.md.`);
  }
  const frontLoaded = [
    "npm run",
    "getStudyContinuation",
    "SQLite",
    "EvidenceEvent",
    "ReviewRatingMapper",
    "FSRS",
    "profile list",
    "recordExposure",
    "submitAndAssess",
    "goal-",
  ];
  const leaked = frontLoaded.filter((token) => lines.some((line) => line.includes(token)));
  if (leaked.length) {
    throw new Error(`${DOC}: starter prompt re-inlines contract detail: ${leaked.join(", ")}.`);
  }
  return lines.length;
}

function checkTeacherStackInventory() {
  const trackedTeacherFiles = [
    "AGENTS.md",
    "CLAUDE.md",
    "skills/learning-os-teacher/SKILL.md",
    "docs/teacher-agent-protocol.md",
    "docs/technical-revision-teacher.md",
    "docs/agent-web-session-instructions.md",
  ];
  const refDir = "skills/learning-os-teacher/references";
  if (existsSync(refDir)) {
    for (const entry of readdirSync(refDir).sort()) {
      if (entry.endsWith(".md")) {
        trackedTeacherFiles.push(join(refDir, entry));
      }
    }
  }
  let words = 0;
  for (const file of trackedTeacherFiles) {
    if (!existsSync(file)) throw new Error(`Tracked teacher doc missing: ${file}`);
    words += countWords(readFileSync(file, "utf8"));
  }
  return { fileCount: trackedTeacherFiles.length, words };
}

async function checkMcpSurface(skillBody) {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  if (!Array.isArray(pkg.files) || !pkg.files.includes("skills/learning-os-teacher")) {
    throw new Error("package.json files must include skills/learning-os-teacher so MCP SERVER_INSTRUCTIONS works when installed.");
  }
  const distMcp = resolve("dist/mcp-server.js");
  if (!existsSync(distMcp)) {
    return null;
  }
  const mod = await import(pathToFileURL(distMcp).href);
  const init = mod.handleJsonRpcMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26" },
  });
  const list = mod.handleJsonRpcMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  const instructions = init?.result?.instructions ?? "";
  const tools = list?.result?.tools ?? [];
  if (instructions.trim() !== skillBody.trim()) {
    throw new Error("MCP initialize.instructions has drifted from skills/learning-os-teacher/SKILL.md (run npm run build).");
  }
  const instrWords = countWords(instructions);
  const descWords = tools.reduce((sum, tool) => sum + countWords(tool.description ?? ""), 0);
  const totalWords = instrWords + descWords;
  const catalogBytes = Buffer.byteLength(JSON.stringify({ instructions, tools }), "utf8");
  if (totalWords > MAX_MCP_ADVERTISED_WORDS) {
    throw new Error(
      `MCP advertised instructions + tool descriptions = ${totalWords} words, exceeding budget of ${MAX_MCP_ADVERTISED_WORDS}.`,
    );
  }
  if (catalogBytes > MAX_MCP_CATALOG_BYTES) {
    throw new Error(
      `MCP serialized instructions + tools/list = ${catalogBytes} bytes, exceeding budget of ${MAX_MCP_CATALOG_BYTES}.`,
    );
  }
  return { instrWords, descWords, totalWords, catalogBytes };
}

async function main() {
  const promptLines = checkStarterPrompt();
  const graph = walkMandatoryGraph(["CLAUDE.md", "AGENTS.md"]);
  const cliWords = graph.reduce((sum, file) => sum + file.words, 0);
  const cliBytes = graph.reduce((sum, file) => sum + file.bytes, 0);
  if (cliWords > MAX_CLI_ENTRY_WORDS) {
    throw new Error(
      `Mandatory CLI entry graph is ${cliWords} words (${graph.map((f) => `${f.path}:${f.words}w`).join(", ")}), exceeding budget of ${MAX_CLI_ENTRY_WORDS}.`,
    );
  }
  if (cliBytes > MAX_CLI_ENTRY_BYTES) {
    throw new Error(
      `Mandatory CLI entry graph is ${cliBytes} bytes, exceeding budget of ${MAX_CLI_ENTRY_BYTES}.`,
    );
  }

  const skillBody = stripFrontmatter(readFileSync("skills/learning-os-teacher/SKILL.md", "utf8"));
  const mcp = await checkMcpSurface(skillBody);
  const stack = checkTeacherStackInventory();

  console.log(
    `Entry check passed (starter=${promptLines} lines; CLI mandatory=${cliWords}w/${cliBytes}B across ${graph.length} files` +
      (mcp ? `; MCP advertised=${mcp.totalWords}w/${mcp.catalogBytes}B` : "; MCP dist not built") +
      `; maintained teacher stack=${stack.words}w across ${stack.fileCount} files).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
