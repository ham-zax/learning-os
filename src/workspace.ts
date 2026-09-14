import { resolve } from "node:path";
import {
  getActiveProfile,
  getProfile,
  listProfiles,
  openProfileDatabase,
  resolveProfile,
} from "./profile/index.js";
import type { ProfileStoreOptions } from "./profile/types.js";
import { loadKnowledgeCatalog, resolveCatalogArea } from "./onboarding/catalog.js";
import { planInformationNeeds } from "./onboarding/questions.js";
import { buildOnboardingProposal } from "./onboarding/planner.js";
import { normalizeOnboardingIntake } from "./onboarding/types.js";
import type {
  IntakeArea,
  KnowledgeCatalog,
  OnboardingIntake,
  OnboardingProposal,
} from "./onboarding/types.js";
import {
  applyConfirmedOnboarding,
  deriveMissingConceptMaterialization,
  getDurablePreparationContext,
  listDurablePreparationContexts,
} from "./onboarding/apply.js";
import type {
  ApplyConfirmedOnboardingInput,
  DeriveMissingConceptMaterializationInput,
  DurablePreparationContext,
} from "./onboarding/apply.js";
import { createTeacherKernel } from "./teacher.js";
import { getConcept, updateConcept } from "./db/database.js";
import {
  codingCourseFile,
  codingCourseIntake,
  codingCourseResources,
  findCodingCourse,
  loadCodingCourses,
  selectCodingUnits,
} from "./knowledge/courses.js";

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
  const courses = () => loadCodingCourses(knowledgeRoot, catalog());
  const course = (id: string) => findCodingCourse(courses(), id);

  return {
    listCourses: courses,
    getCourse: course,
    listCourseResources: (courseId: string) =>
      codingCourseResources(course(courseId), knowledgeRoot),
    buildCourseOnboardingProposal: (input: {
      courseId: string;
      unitIds?: string[];
      intake: OnboardingIntake;
      now: string;
    }) => {
      const knowledgeCatalog = catalog();
      const loaded = findCodingCourse(
        loadCodingCourses(knowledgeRoot, knowledgeCatalog),
        input.courseId,
      );
      const intake = codingCourseIntake(
        loaded,
        knowledgeCatalog,
        input.intake,
        input.unitIds,
      );
      return {
        courseId: input.courseId,
        unitIds: selectCodingUnits(loaded, input.unitIds).map((unit) => unit.id),
        intake,
        planningNow: input.now,
        proposal: buildOnboardingProposal({
          intake,
          catalog: knowledgeCatalog,
          now: input.now,
        }),
      };
    },
    listProfiles: () => listProfiles(profileStore),
    getProfile: (profileId: string) => getProfile(profileId, profileStore),
    getActiveProfile: () => getActiveProfile(profileStore),
    loadKnowledgeCatalog: catalog,
    resolveCatalogArea: (
      area: IntakeArea,
      knowledgeCatalog: KnowledgeCatalog = catalog(),
    ) => resolveCatalogArea(knowledgeCatalog, area),
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
    deriveMissingConceptMaterialization: (
      input: Omit<DeriveMissingConceptMaterializationInput, "catalog"> & { catalog?: KnowledgeCatalog },
    ) => deriveMissingConceptMaterialization({ ...input, catalog: input.catalog ?? catalog() }),
    applyConfirmedOnboarding: (input: WorkspaceApplyConfirmedInput) =>
      applyConfirmedOnboarding({
        ...input,
        catalog: input.catalog ?? catalog(),
        profileStore,
      }),
    openProfile: (profileId?: string) => {
      const profile = resolveProfile(profileId, profileStore);
      const db = openProfileDatabase(profile.id, profileStore);
      const kernel = createTeacherKernel(db);
      return {
        profile,
        kernel,
        getCourseProgress: (goalId: string, courseId: string) => {
          const loaded = course(courseId);
          const context = kernel.getPreparationContext(goalId);
          if (!context) throw new Error(`Unknown prepared goal: ${goalId}`);
          // Course IDs name concept/capability pairs; imported objectives can have other IDs.
          const objectives = new Map(
            context.objectives.map((objective) => [
              `${objective.conceptId}:${objective.capabilityId}`,
              objective,
            ]),
          );
          return {
            courseId,
            goalId,
            focus: context.studyFocus,
            completionClaim: false as const,
            units: loaded.course.units.map((unit) => ({
              unitId: unit.id,
              title: unit.title,
              lane: unit.lane,
              objectives: unit.objectiveIds.map((objectiveId) => ({
                objectiveId,
                selected: objectives.get(objectiveId)?.isActive === true,
                state: objectives.get(objectiveId) ?? null,
              })),
            })),
          };
        },
        setCourseStudyFocus: (input: {
          goalId: string;
          courseId: string;
          unitId: string;
        }) => {
          const loaded = course(input.courseId);
          const unit = selectCodingUnits(loaded, [input.unitId])[0];
          const context = kernel.getPreparationContext(input.goalId);
          if (!context) throw new Error(`Unknown prepared goal: ${input.goalId}`);
          const targets = new Set(unit.objectiveIds);
          const objectiveIds = context.objectives
            .filter(
              (objective) =>
                objective.isActive &&
                targets.has(`${objective.conceptId}:${objective.capabilityId}`),
            )
            .map((objective) => objective.objectiveId);
          if (!objectiveIds.length) {
            throw new Error(
              "This unit has no active targets in the goal; adopt its scope explicitly first",
            );
          }
          return kernel.setGoalStudyFocus({
            goalId: input.goalId,
            label: `${loaded.course.id}/${unit.id}: ${unit.title}`,
            objectiveIds,
          });
        },
        attachCourseReferences: (input: { goalId: string; courseId: string }) => {
          const loaded = course(input.courseId);
          const context = kernel.getPreparationContext(input.goalId);
          if (!context) throw new Error(`Unknown prepared goal: ${input.goalId}`);
          const catalogConcepts = catalog().topics.find(
            (item) => item.topicId === loaded.course.id,
          )!.concepts;
          const related = new Set(context.objectives.map((item) => item.conceptId));
          const visit = (conceptId: string) => {
            for (const prerequisite of getConcept(db, conceptId)?.prerequisites ?? []) {
              if (!related.has(prerequisite)) {
                related.add(prerequisite);
                visit(prerequisite);
              }
            }
          };
          for (const conceptId of [...related]) visit(conceptId);
          const matching = catalogConcepts.filter((item) => related.has(item.conceptId));
          if (!matching.length) throw new Error("Course has no concepts in this goal or its prerequisites");
          const linked: string[] = [];
          const preserved: string[] = [];
          db.transaction(() => {
            for (const item of matching) {
              const existing = getConcept(db, item.conceptId);
              if (!existing) continue;
              if (existing.file_path) {
                preserved.push(item.conceptId);
                continue;
              }
              const file = codingCourseFile(
                loaded.directory,
                `concepts/${item.conceptId}.md`,
              );
              // Reference metadata only. Do not rewrite ownership, prerequisites, evidence or active scope.
              updateConcept(db, item.conceptId, { file_path: file });
              linked.push(item.conceptId);
            }
          })();
          return { linked, preserved };
        },
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
