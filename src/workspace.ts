import { resolve } from "node:path";
import {
  getActiveProfile,
  getProfile,
  listProfiles,
  openProfileDatabase,
  resolveProfile,
} from "./profile/index.js";
import type { ProfileStoreOptions } from "./profile/types.js";
import { loadKnowledgeCatalog } from "./onboarding/catalog.js";
import { planInformationNeeds } from "./onboarding/questions.js";
import { buildOnboardingProposal } from "./onboarding/planner.js";
import { normalizeOnboardingIntake } from "./onboarding/types.js";
import type {
  KnowledgeCatalog,
  OnboardingIntake,
  OnboardingProposal,
} from "./onboarding/types.js";
import {
  applyConfirmedOnboarding,
  getDurablePreparationContext,
  listDurablePreparationContexts,
} from "./onboarding/apply.js";
import type {
  ApplyConfirmedOnboardingInput,
  DurablePreparationContext,
} from "./onboarding/apply.js";
import { createTeacherKernel } from "./teacher.js";

export interface TeacherWorkspaceOptions {
  dataDir?: string;
  knowledgeRoot?: string;
}

export interface BuildWorkspaceProposalInput {
  intake: OnboardingIntake;
  now: string;
  catalog?: KnowledgeCatalog;
}

export type WorkspaceApplyConfirmedInput = Omit<
  ApplyConfirmedOnboardingInput,
  "catalog" | "profileStore"
> & {
  catalog?: KnowledgeCatalog;
};

/**
 * Provider-neutral pre-profile workspace. It owns local profile/catalog
 * resolution while the bound TeacherKernel continues to own learner work after
 * a profile database has been selected.
 */
export function createTeacherWorkspace(options: TeacherWorkspaceOptions = {}) {
  const profileStore: ProfileStoreOptions = {
    ...(options.dataDir ? { dataDir: resolve(options.dataDir) } : {}),
  };
  const knowledgeRoot = resolve(options.knowledgeRoot ?? "knowledge");
  const catalog = () => loadKnowledgeCatalog(knowledgeRoot);

  return {
    listProfiles: () => listProfiles(profileStore),
    getProfile: (profileId: string) => getProfile(profileId, profileStore),
    getActiveProfile: () => getActiveProfile(profileStore),
    loadKnowledgeCatalog: catalog,
    planOnboardingInformationNeeds: (
      intake: OnboardingIntake,
      knowledgeCatalog: KnowledgeCatalog = catalog(),
    ) => planInformationNeeds(normalizeOnboardingIntake(intake), knowledgeCatalog),
    buildOnboardingProposal: (input: BuildWorkspaceProposalInput): OnboardingProposal =>
      buildOnboardingProposal({
        intake: input.intake,
        catalog: input.catalog ?? catalog(),
        now: input.now,
      }),
    applyConfirmedOnboarding: (input: WorkspaceApplyConfirmedInput) =>
      applyConfirmedOnboarding({
        ...input,
        catalog: input.catalog ?? catalog(),
        profileStore,
      }),
    openProfile: (profileId?: string) => {
      const profile = resolveProfile(profileId, profileStore);
      const db = openProfileDatabase(profile.id, profileStore);
      return {
        profile,
        kernel: createTeacherKernel(db),
        listPreparationContexts: (): DurablePreparationContext[] =>
          listDurablePreparationContexts(db),
        getPreparationContext: (goalId: string) =>
          getDurablePreparationContext(db, goalId),
        close: (): void => {
          db.close();
        },
      };
    },
  };
}

export type TeacherWorkspace = ReturnType<typeof createTeacherWorkspace>;
