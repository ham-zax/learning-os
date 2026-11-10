import { existsSync, readFileSync } from "node:fs";

const DOC = "docs/agent-web-session-instructions.md";
const MAX_PROMPT_LINES = 3;

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
  throw new Error(
    `${DOC}: starter prompt is ${lines.length} lines, limit is ${MAX_PROMPT_LINES}.\n` +
      `The prompt is a trigger, not a contract. Move the extra rules to the layer that owns them:\n` +
      `  AGENTS.md -> skills/learning-os-teacher/SKILL.md -> docs/teacher-agent-protocol.md\n` +
      `See "## Entry cascade" in ${DOC}.`,
  );
}

if (!lines.some((line) => line.includes("AGENTS.md"))) {
  throw new Error(
    `${DOC}: starter prompt must name AGENTS.md, otherwise the routing cascade never starts.`,
  );
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
const leaked = frontLoaded.filter((token) =>
  lines.some((line) => line.includes(token)),
);
if (leaked.length) {
  throw new Error(
    `${DOC}: starter prompt re-inlines contract detail: ${leaked.join(", ")}.\n` +
      `That detail is delivered by the cascade. Keep the prompt to intent, topic/goal, and checkout.`,
  );
}

for (const target of [
  "AGENTS.md",
  "skills/learning-os-teacher/SKILL.md",
  "docs/teacher-agent-protocol.md",
]) {
  if (!existsSync(target)) {
    throw new Error(`Entry cascade target is missing: ${target}`);
  }
}

console.log(
  `Entry prompt check passed (${lines.length} line${lines.length === 1 ? "" : "s"}; cascade resolves).`,
);
