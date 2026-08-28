export const LEGACY_PROFILE_ID = "legacy";

export interface LearnerProfile {
  id: string;
  displayName: string;
  createdAt: string;
  description: string | null;
  source: "managed" | "legacy";
}

export interface CreateProfileInput {
  displayName: string;
  description?: string;
  id?: string;
}

export interface ProfileStoreOptions {
  dataDir?: string;
}
