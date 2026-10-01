import Database from "better-sqlite3";
import { resolve } from "node:path";
import { CURRENT_SCHEMA_VERSION } from "./db/schema.js";
import { resolveProfile } from "./profile/index.js";
import type { ProfileStoreOptions } from "./profile/types.js";

/** Read-only operator diagnostics. Deliberately excludes responses and evidence contents. */
export function inspectProfileHealth(profileId?: string, options: ProfileStoreOptions = {}) {
  const profile = resolveProfile(profileId, options);
  const databasePath = resolve(options.dataDir ?? "data", "profiles", profile.id, "tutor.db");
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const schemaVersion = db.pragma("user_version", { simple: true });
    const integrity = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
    const foreignKeyViolations = db.pragma("foreign_key_check") as unknown[];
    const schemaSupported = schemaVersion === CURRENT_SCHEMA_VERSION;
    const healthy = schemaSupported && integrity.length === 1 && integrity[0]?.integrity_check === "ok"
      && foreignKeyViolations.length === 0;
    return {
      healthy, profileId: profile.id, schemaVersion, expectedSchemaVersion: CURRENT_SCHEMA_VERSION,
      integrity: integrity.map((row) => row.integrity_check), foreignKeyViolationCount: foreignKeyViolations.length,
      journalMode: db.pragma("journal_mode", { simple: true }), nodeVersion: process.version,
      pendingSessionCount: schemaSupported
        ? (db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE phase <> 'complete'").get() as { count: number }).count : null,
    };
  } finally {
    db.close();
  }
}
