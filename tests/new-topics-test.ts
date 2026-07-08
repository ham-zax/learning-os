/**
 * Verify the two new topics work end-to-end.
 * Usage: npx tsx tests/new-topics-test.ts
 */

import { resolve } from "node:path";
import { createDatabase, getConcept } from "../src/db/database.js";
import { startSession, gradeResponse, endSession } from "../src/session/engine.js";
import { getTopicSummary } from "../src/state.js";

const DB_PATH = resolve("./data/tutor.db");
const db = createDatabase(DB_PATH);

let errors = 0;

function check(topic: string, label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    console.log(`FAIL [${topic}] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    errors++;
  }
}

// ─── Coding Interview ─────────────────────────────────────────────────────────

console.log("=== Coding Interview ===\n");

const ciState = startSession(db, { topicId: "coding-interview", mode: "explore" });
console.log(`Session ${ciState.sessionId}: ${ciState.concepts.length} concept(s) selected`);

// Should select arrays-hashing, stack, linked-list (all difficulty 1, no prereqs)
// Plus maybe two-pointers (diff 1, prereq arrays-hashing — but arrays-hashing is unseen not mastered)
// Actually only the ones with NO prerequisites: arrays-hashing, stack, linked-list
const ciIds = ciState.concepts.map(c => c.id).sort();
console.log(`  Concepts: ${ciIds.join(", ")}`);
check("coding-interview", "unlocked count", ciState.concepts.length, 3);
check("coding-interview", "has arrays-hashing", ciIds.includes("arrays-hashing"), true);
check("coding-interview", "has stack", ciIds.includes("stack"), true);
check("coding-interview", "has linked-list", ciIds.includes("linked-list"), true);

// Grade arrays-hashing with a 4
const ciResult = gradeResponse(db, "arrays-hashing", 4, "explore", ciState.sessionId);
console.log(`  Graded arrays-hashing: ${ciResult.feedback} (${ciResult.sm2Result.interval}d interval)`);
check("coding-interview", "arrays-hashing status", ciResult.newStatus, "learning");
check("coding-interview", "interval after grade 4", ciResult.sm2Result.interval, 1);

endSession(db, ciState.sessionId);

// ─── System Design ────────────────────────────────────────────────────────────

console.log("\n=== System Design ===\n");

const sdState = startSession(db, { topicId: "system-design", mode: "explore" });
console.log(`Session ${sdState.sessionId}: ${sdState.concepts.length} concept(s) selected`);

// Should select: blob-storage, scalability, sql-fundamentals, cap-theorem (no prereqs, diff 1-2)
const sdIds = sdState.concepts.map(c => c.id).sort();
console.log(`  Concepts: ${sdIds.join(", ")}`);
check("system-design", "unlocked count", sdState.concepts.length, 4);
check("system-design", "has blob-storage", sdIds.includes("blob-storage"), true);
check("system-design", "has scalability", sdIds.includes("scalability"), true);
check("system-design", "has sql-fundamentals", sdIds.includes("sql-fundamentals"), true);
check("system-design", "has cap-theorem", sdIds.includes("cap-theorem"), true);

// Grade scalability with a 3
const sdResult = gradeResponse(db, "scalability", 3, "explore", sdState.sessionId);
console.log(`  Graded scalability: ${sdResult.feedback} (${sdResult.sm2Result.interval}d interval)`);
check("system-design", "scalability status", sdResult.newStatus, "learning");
check("system-design", "interval after grade 3", sdResult.sm2Result.interval, 1);

endSession(db, sdState.sessionId);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log("\n=== Final Stats ===\n");

for (const tid of ["coding-interview", "system-design"]) {
  const s = getTopicSummary(db, tid);
  console.log(`${s.topic}: unseen=${s.unseen} learning=${s.learning} reviewing=${s.reviewing} mastered=${s.mastered} due=${s.dueCount}`);
}

console.log(`\n${errors === 0 ? "✓ ALL CHECKS PASSED" : `✗ ${errors} FAILURES`}`);

// Clean up test data
db.exec("DELETE FROM reviews; DELETE FROM sessions; UPDATE concepts SET ef=2.5, interval=0, repetitions=0, next_review=NULL, last_grade=NULL, status='unseen'; UPDATE topics SET last_session=NULL;");
db.close();

process.exit(errors > 0 ? 1 : 0);
