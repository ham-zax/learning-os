import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeId, resolveContainedPath } from "./safe-path.js";

export const PACKAGED_KNOWLEDGE_DIR = fileURLToPath(
  new URL("../../knowledge", import.meta.url),
);

/**
 * Resolve the curriculum directory for read-only discovery/loading.
 * Uses the configured or workspace `./knowledge` directory when present, and
 * falls back to the packaged `knowledge/` directory shipped with Learning OS
 * when running outside a source checkout.
 */
export function resolveKnowledgeDir(
  configuredDir?: string,
  cwd: string = process.cwd(),
  packagedDir: string = PACKAGED_KNOWLEDGE_DIR,
): string {
  const raw = configuredDir?.trim() || "./knowledge";
  const localDir = resolve(cwd, raw);
  if (existsSync(localDir)) return localDir;
  if (raw === "./knowledge" || raw === "knowledge") {
    if (existsSync(packagedDir)) return resolve(packagedDir);
  }
  return localDir;
}

/**
 * Convert a stored concept file path into a portable `knowledge/`-relative
 * reference when possible, stripping host-specific checkout prefixes.
 */
export function portableKnowledgeRef(
  storedPath: string,
  knowledgeDir?: string,
): string {
  const trimmed = storedPath.trim();
  if (!trimmed) return "";

  const isHostAbsolute = isAbsolute(trimmed) || /^[A-Za-z]:[\\/]/.test(trimmed);
  if (!isHostAbsolute) {
    const posix = trimmed.replace(/\\/g, "/").replace(/^\.\//, "");
    return posix.startsWith("knowledge/") ? posix.slice("knowledge/".length) : posix;
  }

  if (knowledgeDir) {
    const rel = relative(resolve(knowledgeDir), resolve(trimmed));
    if (rel && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) {
      return rel.split(sep).join("/");
    }
  }

  const normalized = trimmed.replace(/\\/g, "/");
  const marker = "/knowledge/";
  const idx = normalized.lastIndexOf(marker);
  if (idx !== -1 && idx + marker.length < normalized.length) {
    return normalized.slice(idx + marker.length);
  }

  return trimmed;
}

/**
 * Locate the markdown file backing a concept beneath `knowledgeDir`.
 * Supports `<topic>/concepts/<id>.md`, `<topic>/<id>/concept.md` (coding-interview),
 * `<topic>/<id>.md` (system-design), and portable or foreign-checkout stored paths.
 */
export function resolveConceptFile(
  knowledgeDir: string,
  topicId: string,
  conceptId: string,
  storedPath?: string | null,
): string | null {
  assertSafeId(topicId, "Topic ID");
  assertSafeId(conceptId, "Concept ID");

  const candidates: string[] = [];
  if (storedPath) {
    const portable = portableKnowledgeRef(storedPath, knowledgeDir);
    if (portable && !isAbsolute(portable) && !/^[A-Za-z]:[\\/]/.test(portable)) {
      const parts = portable.split("/");
      if (!parts.includes("..") && !parts.includes("")) {
        candidates.push(resolveContainedPath(knowledgeDir, portable));
      }
    }
  }

  candidates.push(
    resolveContainedPath(knowledgeDir, `${topicId}/concepts/${conceptId}.md`),
    resolveContainedPath(knowledgeDir, `${topicId}/${conceptId}/concept.md`),
    resolveContainedPath(knowledgeDir, `${topicId}/${conceptId}.md`),
  );

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
