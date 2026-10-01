import { lstatSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

/** IDs used as filenames must remain a single portable path component. */
export function assertSafeId(id: string, label = "ID"): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) || id === "." || id === "..") {
    throw new Error(`${label} must be a safe path component: ${id}`);
  }
}

/** Resolve beneath a trusted root and reject symlinks, including existing targets. */
export function resolveContainedPath(root: string, relativePath: string): string {
  if (!relativePath || isAbsolute(relativePath) || relativePath.includes("\\") || relativePath.includes("\0")) {
    throw new Error(`Unsafe relative path: ${relativePath}`);
  }
  const base = resolve(root);
  const target = resolve(base, relativePath);
  const rel = relative(base, target);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Path escapes root: ${relativePath}`);
  }
  let current = base;
  for (const part of ["", ...rel.split(sep)]) {
    if (part) current = join(current, part);
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error(`Symlink path is not allowed: ${current}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return target;
}
