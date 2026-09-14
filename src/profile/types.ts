export interface LearnerProfile {
  id: string;
  displayName: string;
  createdAt: string;
  description: string | null;
}

export interface CreateProfileInput {
  displayName: string;
  description?: string;
  id?: string;
}

export interface ProfileStoreOptions {
  dataDir?: string;
}
