import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadConcept } from "../src/knowledge/loader.js";
import { submitAttempt } from "../src/kernel/foundation.js";
import {
  answerAttemptSubquestion,
  openAttemptSubquestion,
} from "../src/kernel/questions.js";
import {
  generateChallenge,
  generateTeachBackSession,
  MAX_FEYNMAN_FOLLOWUPS,
  selectFeynmanFollowUp,
} from "../src/session/modes/teach-back.js";
import { createKernelFixture } from "./helpers/kernel-fixture.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

describe("Feynman teach-back protocol", () => {
  it("generates a plain-language teach-back session and adapts challenge phrasing", () => {
    const concept = loadConcept(
      `${repoRoot}knowledge/backend-systems/concepts/latency-percentiles-and-capacity-metrics.md`,
    );
    const session = generateTeachBackSession(concept);
    expect(session.surfaceId).toBe("teach-back");
    expect(session.conceptId).toBe("latency-percentiles-and-capacity-metrics");
    expect(session.openingPrompt).toContain(concept.frontmatter.title);
    expect(session.challengePrompts.length).toBeGreaterThan(0);
    expect(MAX_FEYNMAN_FOLLOWUPS).toBe(1);

    expect(generateChallenge("automatically")).toMatch(/example|concretely/i);
    expect(generateChallenge("it keeps everything consistent across nodes")).toMatch(
      /step by step/i,
    );
  });

  it("triggers one targeted Feynman probe for vague jargon or terse answers, and stops on concrete explanations", () => {
    const concept = loadConcept(
      `${repoRoot}knowledge/backend-systems/concepts/database-transactions-and-concurrent-correctness.md`,
    );

    const vague = selectFeynmanFollowUp(
      "BEGIN and COMMIT handle concurrency automatically so two users can never buy the last seat.",
      concept,
    );
    expect(vague).toMatchObject({
      reason: "vague_jargon",
      phrase: "automatically",
    });
    expect(vague?.prompt).toContain("automatically");

    const terse = selectFeynmanFollowUp("It locks rows so stock stays valid.", concept);
    expect(terse).toMatchObject({
      reason: "short_answer",
      phrase: null,
    });
    expect(terse?.prompt).toContain(concept.frontmatter.title);

    const concrete = selectFeynmanFollowUp(
      "Two concurrent requests at READ COMMITTED both read stock equals 1. A conditional UPDATE with WHERE stock > 0 acquires a row lock so the first commits stock 0 and the second re-evaluates WHERE against 0 and affects zero rows.",
      concept,
    );
    expect(concrete).toBeNull();

    expect(selectFeynmanFollowUp("   ", concept)).toBeNull();
  });

  it("persists a Feynman clarification probe via kernel subquestions and submits cleanly", () => {
    const fixture = createKernelFixture();
    try {
      const { attemptId } = fixture.openPracticeAttempt();
      const first = openAttemptSubquestion(fixture.db, attemptId, {
        promptText: "Explain how conditional updates prevent overselling.",
      });
      const initialResponse = "Postgres handles concurrency automatically inside a transaction.";
      const followUp = selectFeynmanFollowUp(initialResponse, null);
      expect(followUp?.reason).toBe("vague_jargon");

      const followUpSubq = answerAttemptSubquestion(fixture.db, attemptId, {
        seq: first.seq,
        responseText: initialResponse,
        followUpQuestion: { promptText: followUp!.prompt },
      });
      expect(followUpSubq.seq).toBe(2);
      expect(followUpSubq.prompt_text).toBe(followUp!.prompt);

      const clarification =
        "The first UPDATE locks the matching row; the waiting UPDATE re-evaluates WHERE stock > 0 after commit and updates zero rows.";
      answerAttemptSubquestion(fixture.db, attemptId, {
        seq: followUpSubq.seq,
        responseText: clarification,
      });

      const submitted = submitAttempt(fixture.db, attemptId, {
        responseText: `${initialResponse}\n\n${clarification}`,
      });
      expect(submitted.submitted_at).toBeTruthy();
      expect(submitted.response_text).toContain(initialResponse);
      expect(submitted.response_text).toContain(clarification);
    } finally {
      fixture.db.close();
    }
  });

  it("documents the Feynman teach-back protocol and stop rules in the teacher playbook", () => {
    const playbook = readFileSync(
      `${repoRoot}skills/learning-os-teacher/references/reasoning-retrieval-playbook.md`,
      "utf8",
    );
    const skill = readFileSync(
      `${repoRoot}skills/learning-os-teacher/SKILL.md`,
      "utf8",
    );
    expect(playbook).toContain("## Feynman teach-back");
    expect(playbook).toContain("answerAttemptSubquestion");
    expect(playbook).toContain("Honor the stop rule");
    expect(skill).toContain("Feynman teach-back");
  });
});
