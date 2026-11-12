import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// dist/ is generated output only. Never touch learner state or source files.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
rmSync(resolve(projectRoot, "dist"), { recursive: true, force: true });
