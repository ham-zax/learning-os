/**
 * Programmatic end-to-end test of the SM-2 pipeline.
 * Bypasses the interactive CLI to verify core engine correctness.
 *
 * Usage: npx tsx tests/sm2-pipeline-test.ts
 */

import { resolve } from "node:path";
import { createDatabase, getConcept, getConceptsByTopic, getReviewsBySession } from "../src/db/database.js";
import { startSession, gradeResponse, endSession } from "../src/session/engine.js";
import { getTopicSummary, getDueConcepts } from "../src/state.js";

const DB_PATH = resolve("./data/tutor.db");
const db = createDatabase(DB_PATH);

const topicId = "kubernetes";

console.log("=== SM-2 Pipeline Test ===\n");

// 1. Start a session
const state = startSession(db, { topicId, mode: "explore" });
console.log(`Session ${state.sessionId} started: ${state.mode} mode, ${state.concepts.length} concept(s)`);
state.concepts.forEach((c) => console.log(`  → ${c.title} (${c.status}, diff=${c.difficulty}, prereqs=[${c.prerequisites.join(",")}])`));

if (state.concepts.length === 0) {
  console.log("ERROR: No concepts selected!");
  process.exit(1);
}

// 2. Grade each concept
const grades = [4, 3, 5]; // simulate good recall
let i = 0;
for (const concept of state.concepts.slice(0, 3)) {
  const grade = grades[i] ?? 4;
  const result = gradeResponse(db, concept.id, grade, state.mode, state.sessionId);
  console.log(`\nGraded "${concept.title}": grade=${grade} → ${result.feedback}`);
  console.log(`  SM-2: ef=${result.sm2Result.ef.toFixed(4)} interval=${result.sm2Result.interval}d repetitions=${result.sm2Result.repetitions} nextReview=${result.sm2Result.nextReview}`);
  console.log(`  Status: ${concept.status} → ${result.newStatus}`);
  i++;
}

// 3. End session
const summary = endSession(db, state.sessionId);
console.log(`\nSession ended: ${summary.conceptsReviewed} reviewed, avg grade=${summary.averageGrade}, duration=${summary.duration}s`);
console.log(`Next due: ${summary.nextDueDate}`);

// 4. Verify DB state
console.log("\n=== DB Verification ===");

const pods = getConcept(db, "pods");
console.log(`\npods after review:`);
console.log(`  status:     ${pods?.status} (was: unseen)`);
console.log(`  ef:          ${pods?.ef} (was: 2.5)`);
console.log(`  interval:    ${pods?.interval} (was: 0)`);
console.log(`  repetitions: ${pods?.repetitions} (was: 0)`);
console.log(`  next_review: ${pods?.next_review} (was: null)`);
console.log(`  last_grade:  ${pods?.last_grade} (was: null)`);

// Verify reviews were recorded
const reviews = db.prepare("SELECT * FROM reviews WHERE concept_id = 'pods'").all() as Array<{ grade: number; mode: string; feedback: string }>;
console.log(`\nReviews for pods: ${reviews.length}`);
reviews.forEach((r) => console.log(`  grade=${r.grade} mode=${r.mode} feedback="${r.feedback}"`));

// Verify session was updated
const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(state.sessionId) as { ended_at: string | null };
console.log(`\nSession ended_at: ${session?.ended_at ?? "NOT SET (BUG!)"}`);

// 5. Check due concepts and stats
console.log("\n=== Due & Stats ===");
const dueNow = getDueConcepts(db, topicId);
console.log(`Due concepts: ${dueNow.length} (was 10, should be fewer since pods was just reviewed)`);

const topicSummary = getTopicSummary(db, topicId);
console.log(`Topic summary: unseen=${topicSummary.unseen} learning=${topicSummary.learning} reviewing=${topicSummary.reviewing} mastered=${topicSummary.mastered}`);
console.log(`Due: ${topicSummary.dueCount} overdue: ${topicSummary.overdueCount}`);

let errors = 0;

// Verify concept update (grade=4 is neutral — EF stays at 2.5, that's correct)
if (pods?.status !== "learning") { console.log(`FAIL: expected pods status=learning, got ${pods?.status}`); errors++; }
if (pods?.interval !== 1) { console.log(`FAIL: expected interval=1, got ${pods?.interval}`); errors++; }
if (pods?.repetitions !== 1) { console.log(`FAIL: expected repetitions=1, got ${pods?.repetitions}`); errors++; }
if (pods?.next_review === null) { console.log("FAIL: next_review should be set"); errors++; }
if (pods?.last_grade !== 4) { console.log(`FAIL: expected last_grade=4, got ${pods?.last_grade}`); errors++; }
if (reviews.length === 0) { console.log("FAIL: no review record created"); errors++; }
if (reviews.length > 0 && reviews[0].grade !== 4) { console.log(`FAIL: review grade should be 4, got ${reviews[0].grade}`); errors++; }
if (session?.ended_at === null) { console.log("FAIL: session ended_at not set"); errors++; }
if (summary.conceptsReviewed === 0) { console.log("FAIL: session should record reviewed concepts"); errors++; }

console.log(`\n${errors === 0 ? "✓ ALL CHECKS PASSED" : `✗ ${errors} FAILURES`}`);
db.close();
process.exit(errors > 0 ? 1 : 0);
