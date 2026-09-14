import { describe, expect, it } from "vitest";
import {
  createConcept,
  createDatabase,
  createTopic,
} from "../src/db/database.js";
import { createLearningObjective } from "../src/kernel/foundation.js";

describe("current database baseline", () => {
  it("creates the current schema and seeds the five core capabilities", () => {
    const db = createDatabase(":memory:");
    try {
      expect(
        db.prepare("SELECT id FROM capabilities ORDER BY id").all(),
      ).toEqual([
        { id: "debug" },
        { id: "design" },
        { id: "explain" },
        { id: "implement" },
        { id: "predict" },
      ]);

      createTopic(db, { id: "topic", name: "Topic" });
      createConcept(db, { id: "concept", topicId: "topic", title: "Concept" });
      expect(
        createLearningObjective(db, {
          id: "concept:explain",
          conceptId: "concept",
          capabilityId: "explain",
        }),
      ).toMatchObject({
        id: "concept:explain",
        concept_id: "concept",
        capability_id: "explain",
      });

      const attemptColumns = db
        .prepare("PRAGMA table_info(attempts)")
        .all()
        .map((row) => (row as { name: string }).name);
      expect(attemptColumns).not.toEqual(
        expect.arrayContaining(["problem_id", "score", "feedback"]),
      );
      expect(
        db.prepare("PRAGMA index_list(attempts)").all(),
      ).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "idx_attempts_problem_id" }),
        ]),
      );
    } finally {
      db.close();
    }
  });
});
