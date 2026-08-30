import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type Database from "better-sqlite3";
import { createDatabase } from "../db/database.js";
import {
  LEGACY_PROFILE_ID,
  type CreateProfileInput,
  type LearnerProfile,
  type ProfileStoreOptions,
} from "./types.js";

export type {
  CreateProfileInput,
  LearnerProfile,
  ProfileStoreOptions,
} from "./types.js";
export { LEGACY_PROFILE_ID } from "./types.js";

const REGISTRY_VERSION = 1;
const PROFILE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PROFILE_ID_LENGTH = 64;
const REGISTRY_LOCK_RETRY_MS = 10;
const REGISTRY_LOCK_TIMEOUT_MS = 5_000;
const REGISTRY_LOCK_STALE_MS = 30_000;
const REGISTRY_LOCK_WAIT = new Int32Array(new SharedArrayBuffer(4));

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
  dataDir: string;
  profilesDir: string;
  registryPath: string;
  legacyDatabasePath: string;
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
    dataDir,
    profilesDir,
    registryPath: join(profilesDir, "registry.json"),
    legacyDatabasePath: join(dataDir, "tutor.db"),
  };
}

function assertProfileId(value: string, allowLegacy = false): string {
  if (
    value.length === 0 ||
    value.length > MAX_PROFILE_ID_LENGTH ||
    !PROFILE_ID_PATTERN.test(value)
  ) {
    throw new Error(
      "Profile ID must contain only lowercase letters, numbers, and single hyphen separators.",
    );
  }
  if (!allowLegacy && value === LEGACY_PROFILE_ID) {
    throw new Error(`Profile ID "${LEGACY_PROFILE_ID}" is reserved for legacy data.`);
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
  return profile.source === "legacy"
    ? paths.legacyDatabasePath
    : managedDatabasePath(paths, profile.id);
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
    assertProfileId(activeProfileId, true);
  }

  return {
    version: REGISTRY_VERSION,
    activeProfileId: activeProfileId as string | null,
    profiles,
  };
}

function saveRegistry(paths: ProfilePaths, registry: ProfileRegistry): void {
  mkdirSync(paths.profilesDir, { recursive: true, mode: 0o700 });
  const tempPath = `${paths.registryPath}.tmp-${process.pid}`;
  writeFileSync(tempPath, `${JSON.stringify(registry, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(tempPath, paths.registryPath);
}

function withRegistryLock<T>(paths: ProfilePaths, operation: () => T): T {
  mkdirSync(paths.profilesDir, { recursive: true, mode: 0o700 });
  const lockPath = `${paths.registryPath}.lock`;
  const deadline = Date.now() + REGISTRY_LOCK_TIMEOUT_MS;

  while (true) {
    try {
      mkdirSync(lockPath, { mode: 0o700 });
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;

      try {
        const stats = statSync(lockPath);
        if (Date.now() - stats.mtimeMs > REGISTRY_LOCK_STALE_MS) {
          rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw statError;
      }

      if (Date.now() >= deadline) {
        throw new Error("Timed out waiting for learner profile registry lock.");
      }
      Atomics.wait(REGISTRY_LOCK_WAIT, 0, 0, REGISTRY_LOCK_RETRY_MS);
    }
  }

  try {
    return operation();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

function toManagedProfile(profile: RegistryProfile): LearnerProfile {
  return { ...profile, source: "managed" };
}

function legacyProfile(paths: ProfilePaths): LearnerProfile | null {
  if (!existsSync(paths.legacyDatabasePath)) return null;
  const stats = statSync(paths.legacyDatabasePath);
  const created = stats.birthtimeMs > 0 ? stats.birthtime : stats.ctime;
  return {
    id: LEGACY_PROFILE_ID,
    displayName: "Legacy tutor.db",
    createdAt: created.toISOString(),
    description: "Pre-profile Learning OS database preserved at data/tutor.db.",
    source: "legacy",
  };
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
  const profiles = registry.profiles.map(toManagedProfile);
  const legacy = legacyProfile(paths);
  if (legacy) profiles.push(legacy);
  return profiles.sort((left, right) => left.id.localeCompare(right.id));
}

export function getProfile(
  profileId: string,
  options: ProfileStoreOptions = {},
): LearnerProfile | null {
  const paths = profilePaths(options);
  const id = assertProfileId(profileId, true);
  if (id === LEGACY_PROFILE_ID) return legacyProfile(paths);
  const profile = loadRegistry(paths).profiles.find((candidate) => candidate.id === id);
  return profile ? toManagedProfile(profile) : null;
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
      return toManagedProfile(profile);
    } catch (error) {
      rmSync(profileDir, { recursive: true, force: true });
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
  if (profile.source !== "managed") {
    throw new Error("Legacy profiles cannot be discarded by provisioning recovery.");
  }
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
      renameSync(quarantine, profileDir);
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

  return legacyProfile(paths);
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
