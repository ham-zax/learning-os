import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  chmodSync,
  copyFileSync,
  closeSync,
  fsyncSync,
  mkdtempSync,
  openSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import { CURRENT_SCHEMA_VERSION } from "../db/schema.js";
import { createDatabase } from "../db/database.js";
import type {
  CreateProfileInput,
  LearnerProfile,
  ProfileStoreOptions,
} from "./types.js";

export type {
  CreateProfileInput,
  LearnerProfile,
  ProfileStoreOptions,
} from "./types.js";
const REGISTRY_VERSION = 1;
const PROFILE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PROFILE_ID_LENGTH = 64;
const REGISTRY_LOCK_TIMEOUT_MS = 5_000;

interface RegistryProfile {
  id: string;
  displayName: string;
  createdAt: string;
  description: string | null;
}

interface ProfileRegistry {
  version: 1;
  activeProfileId: string | null;
  profiles: RegistryProfile[];
}

interface ProfilePaths {
  profilesDir: string;
  registryPath: string;
}

interface WalCheckpointResult {
  busy: number;
  log: number;
  checkpointed: number;
}

interface IntegrityCheckResult {
  integrity_check: string;
}

export interface ProfileCheckpoint {
  profile: LearnerProfile;
  databasePath: string;
  integrity: "ok";
  walFramesCheckpointed: number;
  walFramesRemaining: number;
}

function profilePaths(options: ProfileStoreOptions = {}): ProfilePaths {
  const dataDir = resolve(options.dataDir ?? "data");
  const profilesDir = join(dataDir, "profiles");
  return {
    profilesDir,
    registryPath: join(profilesDir, "registry.json"),
  };
}

function assertProfileId(value: string): string {
  if (
    value.length === 0 ||
    value.length > MAX_PROFILE_ID_LENGTH ||
    !PROFILE_ID_PATTERN.test(value)
  ) {
    throw new Error(
      "Profile ID must contain only lowercase letters, numbers, and single hyphen separators.",
    );
  }
  return value;
}

function assertContainedProfilePath(profilesDir: string, profileId: string): string {
  const candidate = resolve(profilesDir, profileId);
  const rel = relative(profilesDir, candidate);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Profile ID escapes the profile directory: ${profileId}`);
  }
  return candidate;
}

function managedProfileDirectory(paths: ProfilePaths, profileId: string): string {
  assertProfileId(profileId);
  return assertContainedProfilePath(paths.profilesDir, profileId);
}

function managedDatabasePath(paths: ProfilePaths, profileId: string): string {
  return join(managedProfileDirectory(paths, profileId), "tutor.db");
}

function databasePathForProfile(paths: ProfilePaths, profile: LearnerProfile): string {
  return managedDatabasePath(paths, profile.id);
}

function emptyRegistry(): ProfileRegistry {
  return { version: REGISTRY_VERSION, activeProfileId: null, profiles: [] };
}

function requireTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp.`);
  }
  return value;
}

function parseRegistryProfile(value: unknown): RegistryProfile {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid profile registry entry.");
  }
  const raw = value as Record<string, unknown>;
  const id = assertProfileId(typeof raw.id === "string" ? raw.id : "");
  if (typeof raw.displayName !== "string" || raw.displayName.trim().length === 0) {
    throw new Error(`Profile ${id} has an invalid display name.`);
  }
  if (raw.description !== null && typeof raw.description !== "string") {
    throw new Error(`Profile ${id} has an invalid description.`);
  }
  return {
    id,
    displayName: raw.displayName,
    createdAt: requireTimestamp(raw.createdAt, `Profile ${id} createdAt`),
    description: raw.description as string | null,
  };
}

function loadRegistry(paths: ProfilePaths): ProfileRegistry {
  if (!existsSync(paths.registryPath)) return emptyRegistry();

  const raw = JSON.parse(readFileSync(paths.registryPath, "utf8")) as unknown;
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid profile registry.");
  }
  const record = raw as Record<string, unknown>;
  if (record.version !== REGISTRY_VERSION || !Array.isArray(record.profiles)) {
    throw new Error(`Unsupported profile registry version: ${String(record.version)}`);
  }

  const profiles = record.profiles.map(parseRegistryProfile);
  if (new Set(profiles.map((profile) => profile.id)).size !== profiles.length) {
    throw new Error("Profile registry contains duplicate profile IDs.");
  }

  const activeProfileId = record.activeProfileId;
  if (activeProfileId !== null && typeof activeProfileId !== "string") {
    throw new Error("Profile registry activeProfileId must be a string or null.");
  }
  if (typeof activeProfileId === "string") {
    assertProfileId(activeProfileId);
  }

  return {
    version: REGISTRY_VERSION,
    activeProfileId: activeProfileId as string | null,
    profiles,
  };
}

function syncFile(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function saveRegistry(paths: ProfilePaths, registry: ProfileRegistry): void {
  mkdirSync(paths.profilesDir, { recursive: true, mode: 0o700 });
  const tempPath = `${paths.registryPath}.tmp-${process.pid}-${randomUUID()}`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(registry, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    syncFile(tempPath);
    renameSync(tempPath, paths.registryPath);
    syncFile(paths.profilesDir);
  } finally {
    rmSync(tempPath, { force: true });
  }
}

function withRegistryLock<T>(paths: ProfilePaths, operation: () => T): T {
  mkdirSync(paths.profilesDir, { recursive: true, mode: 0o700 });
  // SQLite owns the writer lock until commit/rollback or process termination.
  // Never remove this coordination file: doing so splits live writers by inode.
  const lockPath = `${paths.registryPath}.lock.db`;
  const lock = new Database(lockPath, { timeout: REGISTRY_LOCK_TIMEOUT_MS });
  try {
    chmodSync(lockPath, 0o600);
    lock.pragma(`busy_timeout = ${REGISTRY_LOCK_TIMEOUT_MS}`);
    lock.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      lock.exec("COMMIT");
      return result;
    } catch (error) {
      lock.exec("ROLLBACK");
      throw error;
    }
  } finally {
    lock.close();
  }
}

function toLearnerProfile(profile: RegistryProfile): LearnerProfile {
  return { ...profile };
}

export function deriveProfileId(displayName: string): string {
  const id = displayName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_PROFILE_ID_LENGTH)
    .replace(/-+$/g, "");
  return assertProfileId(id);
}

export function listProfiles(options: ProfileStoreOptions = {}): LearnerProfile[] {
  const paths = profilePaths(options);
  const registry = loadRegistry(paths);
  return registry.profiles
    .map(toLearnerProfile)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function getProfile(
  profileId: string,
  options: ProfileStoreOptions = {},
): LearnerProfile | null {
  const paths = profilePaths(options);
  const id = assertProfileId(profileId);
  const profile = loadRegistry(paths).profiles.find((candidate) => candidate.id === id);
  return profile ? toLearnerProfile(profile) : null;
}

export function createProfile(
  input: CreateProfileInput,
  options: ProfileStoreOptions = {},
): LearnerProfile {
  const displayName = input.displayName.trim();
  if (displayName.length === 0) {
    throw new Error("Profile display name must not be empty.");
  }
  const description = input.description?.trim() || null;
  const id = input.id === undefined ? deriveProfileId(displayName) : assertProfileId(input.id);
  const paths = profilePaths(options);

  return withRegistryLock(paths, () => {
    const registry = loadRegistry(paths);
    if (registry.profiles.some((profile) => profile.id === id)) {
      throw new Error(`Profile already exists: ${id}`);
    }

    const profileDir = managedProfileDirectory(paths, id);
    if (existsSync(profileDir)) {
      throw new Error(
        `Profile directory already exists without a registry entry; refusing to adopt or overwrite it: ${id}`,
      );
    }

    mkdirSync(profileDir, { recursive: true, mode: 0o700 });
    try {
      const db = createDatabase(managedDatabasePath(paths, id));
      db.close();

      const profile: RegistryProfile = {
        id,
        displayName,
        createdAt: new Date().toISOString(),
        description,
      };
      registry.profiles.push(profile);
      registry.profiles.sort((left, right) => left.id.localeCompare(right.id));
      saveRegistry(paths, registry);
      return toLearnerProfile(profile);
    } catch (error) {
      // A directory fsync can fail after the registry rename has published it.
      // Preserve a registered database rather than leave a dangling registry entry.
      if (!loadRegistry(paths).profiles.some((profile) => profile.id === id)) {
        rmSync(profileDir, { recursive: true, force: true });
      }
      throw error;
    }
  });
}

/**
 * Recovery hook for a profile created by the current provisioning attempt.
 * The exact creation timestamp and unselected state must still match, so this
 * cannot silently reset an older learner profile with the same ID.
 */
export function discardCreatedProfile(
  profile: LearnerProfile,
  options: ProfileStoreOptions = {},
): void {
  const paths = profilePaths(options);
  withRegistryLock(paths, () => {
    const registry = loadRegistry(paths);
    if (registry.activeProfileId === profile.id) {
      throw new Error(`Cannot discard selected profile: ${profile.id}`);
    }
    const registered = registry.profiles.find((candidate) => candidate.id === profile.id);
    if (!registered || registered.createdAt !== profile.createdAt) {
      throw new Error(`Provisioning profile identity no longer matches: ${profile.id}`);
    }
    const profileDir = managedProfileDirectory(paths, profile.id);
    if (!existsSync(profileDir)) {
      throw new Error(`Provisioning profile directory is missing: ${profile.id}`);
    }

    const quarantine = `${profileDir}.discard-${process.pid}`;
    renameSync(profileDir, quarantine);
    try {
      saveRegistry(paths, {
        ...registry,
        profiles: registry.profiles.filter((candidate) => candidate.id !== profile.id),
      });
    } catch (error) {
      if (loadRegistry(paths).profiles.some((candidate) => candidate.id === profile.id)) {
        renameSync(quarantine, profileDir);
      } else {
        rmSync(quarantine, { recursive: true, force: true });
      }
      throw error;
    }
    rmSync(quarantine, { recursive: true, force: true });
  });
}

export function selectProfile(
  profileId: string,
  options: ProfileStoreOptions = {},
): LearnerProfile {
  const paths = profilePaths(options);
  return withRegistryLock(paths, () => {
    const profile = getProfile(profileId, options);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    const registry = loadRegistry(paths);
    registry.activeProfileId = profile.id;
    saveRegistry(paths, registry);
    return profile;
  });
}

export function getActiveProfile(
  options: ProfileStoreOptions = {},
): LearnerProfile | null {
  const paths = profilePaths(options);
  const registry = loadRegistry(paths);

  if (registry.activeProfileId !== null) {
    const active = getProfile(registry.activeProfileId, options);
    if (!active) {
      throw new Error(`Selected profile is no longer available: ${registry.activeProfileId}`);
    }
    return active;
  }

  return null;
}

export function resolveProfile(
  profileId?: string,
  options: ProfileStoreOptions = {},
): LearnerProfile {
  if (profileId !== undefined) {
    const profile = getProfile(profileId, options);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    return profile;
  }

  const active = getActiveProfile(options);
  if (active) return active;
  throw new Error(
    "No learner profile is selected. Create one with `tutor profile create <name>` or select one with `tutor profile use <id>`.",
  );
}

export function openProfileDatabase(
  profileId?: string,
  options: ProfileStoreOptions = {},
): Database.Database {
  const paths = profilePaths(options);
  const profile = resolveProfile(profileId, options);
  const dbPath = databasePathForProfile(paths, profile);
  if (!existsSync(dbPath)) {
    throw new Error(`Profile database is missing: ${profile.id}`);
  }
  return createDatabase(dbPath);
}

export function checkpointProfileDatabase(
  profileId?: string,
  options: ProfileStoreOptions = {},
): ProfileCheckpoint {
  const paths = profilePaths(options);
  const profile = resolveProfile(profileId, options);
  const databasePath = databasePathForProfile(paths, profile);
  if (!existsSync(databasePath)) {
    throw new Error(`Profile database is missing: ${profile.id}`);
  }

  const db = createDatabase(databasePath);
  try {
    const [checkpoint] = db.pragma("wal_checkpoint(TRUNCATE)") as WalCheckpointResult[];
    if (!checkpoint || checkpoint.busy !== 0) {
      throw new Error(`Profile database checkpoint is busy: ${profile.id}`);
    }
    const walFramesRemaining = Math.max(0, checkpoint.log - checkpoint.checkpointed);
    if (walFramesRemaining !== 0) {
      throw new Error(
        `Profile database still has ${walFramesRemaining} WAL frame(s): ${profile.id}`,
      );
    }

    const integrityRows = db.pragma("integrity_check") as IntegrityCheckResult[];
    if (integrityRows.length !== 1 || integrityRows[0]?.integrity_check !== "ok") {
      throw new Error(`Profile database integrity check failed: ${profile.id}`);
    }

    return {
      profile,
      databasePath,
      integrity: "ok",
      walFramesCheckpointed: checkpoint.checkpointed,
      walFramesRemaining,
    };
  } finally {
    db.close();
  }
}

export interface ProfileBackupManifest {
  version: 1;
  createdAt: string;
  schemaVersion: number;
  profile: LearnerProfile;
  database: { file: "tutor.db"; sha256: string };
}

export interface ProfileBackup {
  snapshotDir: string;
  manifest: ProfileBackupManifest;
}

function databaseChecksum(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function validateSnapshotDatabase(path: string): void {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const version = db.pragma("user_version", { simple: true });
    if (version !== CURRENT_SCHEMA_VERSION) {
      throw new Error(`Unsupported snapshot schema v${String(version)}; expected v${CURRENT_SCHEMA_VERSION}.`);
    }
    const integrity = db.pragma("integrity_check") as IntegrityCheckResult[];
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok") {
      throw new Error("Snapshot database integrity check failed.");
    }
    if ((db.pragma("foreign_key_check") as unknown[]).length !== 0) {
      throw new Error("Snapshot database foreign key check failed.");
    }
    // user_version alone does not establish that the complete current schema exists.
    const schemaQuery = "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name";
    const expected = createDatabase(":memory:");
    try {
      if (JSON.stringify(db.prepare(schemaQuery).all()) !== JSON.stringify(expected.prepare(schemaQuery).all())) {
        throw new Error("Snapshot database does not match the current learner schema.");
      }
    } finally {
      expected.close();
    }
  } finally {
    db.close();
  }
}

function readBackupManifest(snapshotDir: string): ProfileBackupManifest {
  const raw = JSON.parse(readFileSync(join(snapshotDir, "manifest.json"), "utf8")) as Record<string, unknown>;
  if (!raw || typeof raw !== "object" || raw.version !== 1 || raw.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error("Unsupported profile backup manifest or schema version.");
  }
  const profile = parseRegistryProfile(raw.profile);
  const database = raw.database as Record<string, unknown> | undefined;
  if (!database || database.file !== "tutor.db" || typeof database.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(database.sha256)) {
    throw new Error("Invalid profile backup database checksum.");
  }
  return {
    version: 1,
    createdAt: requireTimestamp(raw.createdAt, "Backup createdAt"),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile,
    database: { file: "tutor.db", sha256: database.sha256 },
  };
}

/** Create a standalone, consistent SQLite snapshot, including committed WAL state. */
export async function backupProfile(
  snapshotDir: string,
  profileId?: string,
  options: ProfileStoreOptions = {},
): Promise<ProfileBackup> {
  const paths = profilePaths(options);
  const profile = resolveProfile(profileId, options);
  const destination = resolve(snapshotDir);
  if (existsSync(destination)) throw new Error(`Backup destination already exists: ${destination}`);
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = mkdtempSync(join(dirname(destination), ".profile-backup-"));
  chmodSync(temporary, 0o700);
  try {
    const source = new Database(databasePathForProfile(paths, profile), { readonly: true, fileMustExist: true });
    try {
      await source.backup(join(temporary, "tutor.db"));
    } finally {
      source.close();
    }
    const databasePath = join(temporary, "tutor.db");
    chmodSync(databasePath, 0o600);
    validateSnapshotDatabase(databasePath);
    const manifest: ProfileBackupManifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profile,
      database: { file: "tutor.db", sha256: databaseChecksum(databasePath) },
    };
    writeFileSync(join(temporary, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    syncFile(databasePath);
    syncFile(join(temporary, "manifest.json"));
    syncFile(temporary);
    if (existsSync(destination)) throw new Error(`Backup destination already exists: ${destination}`);
    renameSync(temporary, destination);
    syncFile(dirname(destination));
    return { snapshotDir: destination, manifest };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

/** Restore into a newly registered, unselected profile; existing profiles are never replaced. */
export function restoreProfile(
  snapshotDir: string,
  input: CreateProfileInput,
  options: ProfileStoreOptions = {},
): LearnerProfile {
  const manifest = readBackupManifest(resolve(snapshotDir));
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("Profile display name must not be empty.");
  const id = input.id === undefined ? deriveProfileId(displayName) : assertProfileId(input.id);
  const paths = profilePaths(options);
  return withRegistryLock(paths, () => {
    const registry = loadRegistry(paths);
    const destination = managedProfileDirectory(paths, id);
    if (registry.profiles.some((profile) => profile.id === id) || existsSync(destination)) {
      throw new Error(`Profile already exists or has an unregistered directory: ${id}`);
    }
    const temporary = mkdtempSync(join(paths.profilesDir, ".profile-restore-"));
    chmodSync(temporary, 0o700);
    let published = false;
    try {
      const databasePath = join(temporary, "tutor.db");
      copyFileSync(join(resolve(snapshotDir), "tutor.db"), databasePath);
      chmodSync(databasePath, 0o600);
      if (databaseChecksum(databasePath) !== manifest.database.sha256) {
        throw new Error("Profile backup database checksum mismatch.");
      }
      validateSnapshotDatabase(databasePath);
      syncFile(databasePath);
      syncFile(temporary);
      const profile: LearnerProfile = {
        id,
        displayName,
        description: input.description === undefined ? manifest.profile.description : input.description.trim() || null,
        createdAt: new Date().toISOString(),
      };
      renameSync(temporary, destination);
      published = true;
      registry.profiles.push(profile);
      registry.profiles.sort((left, right) => left.id.localeCompare(right.id));
      saveRegistry(paths, registry);
      return profile;
    } catch (error) {
      if (published && !loadRegistry(paths).profiles.some((profile) => profile.id === id)) {
        rmSync(destination, { recursive: true, force: true });
      }
      throw error;
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });
}
