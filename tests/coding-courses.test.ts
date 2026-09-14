import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConcept, getConcept, setGoalObjective } from "../src/db/database.js";
import { createLearningObjective } from "../src/kernel/foundation.js";
import { codingCourseFile } from "../src/knowledge/courses.js";
import { createProfile, openProfileDatabase } from "../src/profile/index.js";
import { createTeacherWorkspace } from "../src/workspace.js";
import { createKernelFixture, GOAL_ID } from "./helpers/kernel-fixture.js";

const knowledgeRoot = fileURLToPath(new URL("../knowledge", import.meta.url));

describe("coding course workspace", () => {
  let root: string;
  let dataDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "learning-os-courses-"));
    dataDir = join(root, "data");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("discovers both routes and proposes only the selected unit without creating a profile", () => {
    const workspace = createTeacherWorkspace({ knowledgeRoot, dataDir });
    expect(workspace.listCourses().map(({ course }) => course.id)).toEqual([
      "backend-systems", "frontend-revision",
    ]);

    const selected = workspace.getCourse("frontend-revision").course.units
      .find((unit) => unit.id === "f02")!;
    const draft = workspace.buildCourseOnboardingProposal({
      courseId: "frontend-revision",
      unitIds: ["f02"],
      now: "2026-09-14T00:00:00.000Z",
      intake: {
        targetOutcome: "Explain asynchronous JavaScript behavior",
        purpose: "long_term_mastery",
        deadlineAt: null,
        availability: { minutesPerDay: 30, daysPerWeek: 5 },
      },
    });

    expect(draft.intake.mustCover?.flatMap((area) =>
      area.capabilities?.map((capability) => `${area.conceptId}:${capability}`) ?? [],
    ).sort()).toEqual([...selected.objectiveIds].sort());
    expect(draft.proposal.objectives).toHaveLength(selected.objectiveIds.length);
    expect(existsSync(dataDir)).toBe(false);
  });

  it("preserves imported objective IDs in progress and focus, without activating missing targets", () => {
    const profile = createProfile({ id: "learner", displayName: "Learner" }, { dataDir });
    const fixture = createKernelFixture(join(dataDir, "profiles", profile.id, "tutor.db"));
    const importedId = "imported-async-prediction";
    createConcept(fixture.db, { id: "js-async-await", topicId: GOAL_ID, title: "Async functions" });
    createLearningObjective(fixture.db, {
      id: importedId, conceptId: "js-async-await", capabilityId: "predict",
    });
    setGoalObjective(fixture.db, { goalId: GOAL_ID, objectiveId: importedId, importance: "core" });
    fixture.db.close();

    const bound = createTeacherWorkspace({ knowledgeRoot, dataDir }).openProfile(profile.id);
    try {
      const before = bound.kernel.getGoalObjectives(GOAL_ID);
      const unit = bound.getCourseProgress(GOAL_ID, "frontend-revision").units
        .find((item) => item.unitId === "f02")!;
      expect(unit.objectives.find((item) => item.objectiveId === "js-async-await:predict"))
        .toMatchObject({ selected: true, state: { objectiveId: importedId } });
      expect(unit.objectives.find((item) => item.objectiveId === "js-async-await:implement"))
        .toMatchObject({ selected: false, state: null });

      bound.setCourseStudyFocus({ goalId: GOAL_ID, courseId: "frontend-revision", unitId: "f02" });
      expect(bound.getPreparationContext(GOAL_ID)?.studyFocus?.objectiveIds).toEqual([importedId]);
      expect(bound.kernel.getGoalObjectives(GOAL_ID)).toEqual(before);

      expect(bound.attachCourseReferences({ goalId: GOAL_ID, courseId: "frontend-revision" }))
        .toEqual({ linked: ["js-async-await"], preserved: [] });
      expect(bound.attachCourseReferences({ goalId: GOAL_ID, courseId: "frontend-revision" }))
        .toEqual({ linked: [], preserved: ["js-async-await"] });
    } finally {
      bound.close();
    }

    const db = openProfileDatabase(profile.id, { dataDir });
    try {
      expect(getConcept(db, "js-async-await")?.topic_id).toBe(GOAL_ID);
      expect(db.prepare("SELECT COUNT(*) AS count FROM evidence_events").get()).toEqual({ count: 0 });
      expect(db.prepare("SELECT COUNT(*) AS count FROM attempts").get()).toEqual({ count: 0 });
    } finally {
      db.close();
    }
  });

  it("rejects references that escape the course through a parent path or symlink", () => {
    const courseDir = mkdtempSync(join(root, "course-"));
    const outside = join(root, "outside.md");
    writeFileSync(outside, "Outside course");
    symlinkSync(outside, join(courseDir, "linked.md"));
    expect(() => codingCourseFile(courseDir, "../outside.md")).toThrow("outside-course");
    expect(() => codingCourseFile(courseDir, "linked.md")).toThrow("outside-course");
  });
});
