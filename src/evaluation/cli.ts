import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, openSync, readSync, closeSync } from "node:fs";
import { adhocTeacherScenarios, getAdhocTeacherScenario, inspectAdhocTeacherReply } from "./adhoc-teacher.js";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { publicAssessorCases, scoreAssessorSubmission } from "./assessment-calibration.js";
import { summarizeDogfoodMetrics } from "./dogfood-metrics.js";
import { MAX_REVIEW_INPUT_BYTES, reviewTeacherReply } from "./jev-review.js";
import { loadOutcomeManifest, summarizeLearningOutcomes } from "./learning-outcomes.js";
import {
  adviseOnReply,
  inspectTeacherScenario,
  prepareTeacherScenario,
  teacherScenarios,
  type PreparedTeacherScenario,
  type TeacherScenarioId,
} from "./teacher-scenarios.js";

function usage(): never {
  throw new Error("Usage: npm run eval:teacher -- <list | prepare CASE_ID [DIRECTORY] | inspect DIRECTORY [REPLY_FILE] | adhoc-cases | adhoc-inspect CASE_ID REPLY_FILE | assessor-cases | grade-assessments FILE | metrics DATABASE GOAL_ID | outcomes MANIFEST [AS_OF] | review-reply FILE>");
}

async function main(args: string[]): Promise<void> {
  const [command, value, extra] = args;
  if (command === "review-reply" && value && args.length === 2) {
    const fd = openSync(resolve(value), "r");
    let input: unknown;
    try {
      const buffer = Buffer.alloc(MAX_REVIEW_INPUT_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const count = readSync(fd, buffer, length, buffer.length - length, null);
        if (count === 0) break;
        length += count;
      }
      if (length > MAX_REVIEW_INPUT_BYTES) throw new Error("Review input exceeds 64 KiB.");
      input = JSON.parse(buffer.toString("utf8", 0, length)) as unknown;
    } finally {
      closeSync(fd);
    }
    const report = await reviewTeacherReply(input);
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== "reviewed") process.exitCode = 1;
    return;
  }
  if (command === "list" && !value) {
    for (const scenario of teacherScenarios) console.log(`${scenario.id}\t${scenario.title}`);
    return;
  }
  if (command === "prepare" && value) {
    const scenario = teacherScenarios.find((item) => item.id === value);
    if (!scenario) throw new Error(`Unknown teacher scenario: ${value}`);
    const dir = extra ? resolve(extra) : mkdtempSync(join(tmpdir(), `learning-os-teacher-eval-${value}-`));
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, "tutor.db");
    if (existsSync(dbPath) || existsSync(join(dir, "scenario.json"))) {
      throw new Error(`Evaluation output already exists in ${dir}`);
    }
    const prepared = prepareTeacherScenario(value as TeacherScenarioId, dbPath);
    writeFileSync(join(dir, "scenario.json"), JSON.stringify({ prepared, learnerMessage: scenario.learnerMessage,
      startingPoint: scenario.startingPoint }, null, 2) + "\n");
    console.log(JSON.stringify({ directory: dir, dbPath, goalId: prepared.goalId,
      sessionId: prepared.sessionId, learnerMessage: scenario.learnerMessage,
      instruction: "Have a fresh compatible teacher continue this synthetic DB through the public teacher API. Then run inspect on the directory. The reviewer must also inspect the learner-facing response." }, null, 2));
    return;
  }
  if (command === "inspect" && value) {
    const dir = resolve(value);
    const manifest = JSON.parse(readFileSync(join(dir, "scenario.json"), "utf8")) as { prepared: PreparedTeacherScenario };
    const scenario = teacherScenarios.find((item) => item.id === manifest.prepared.id);
    if (!scenario) throw new Error(`Unknown teacher scenario in manifest: ${manifest.prepared.id}`);
    const checks = inspectTeacherScenario(join(dir, "tutor.db"), manifest.prepared);
    console.log(JSON.stringify({ caseId: scenario.id, automatedChecks: checks,
      passed: checks.filter((item) => item.passed).length, total: checks.length,
      reviewerChecks: scenario.review,
      ...(extra ? { replyAdvisories: { advisory: true, note: "Lexical heuristics on the saved reply; they never change the exit code and cannot replace human review.",
        flags: adviseOnReply(join(dir, "tutor.db"), manifest.prepared, readFileSync(resolve(extra), "utf8")) } } : {}),
      limitation: "Database checks cannot establish whether the teacher's question was neutral, feedback was accurate, or exposure was shown immediately after recording." }, null, 2));
    if (checks.some((item) => !item.passed)) process.exitCode = 1;
    return;
  }
  if (command === "adhoc-cases" && !value && !extra) {
    console.log(JSON.stringify({ scenarios: adhocTeacherScenarios.map(({ id, title, priorContext, learnerMessage }) =>
      ({ id, title, priorContext, learnerMessage })),
      instructions: "Run each scenario with a fresh teacher and its current Teacher skill. Supply priorContext and learnerMessage as separate context and user turn. Reviewer criteria are intentionally omitted; obtain them with adhoc-inspect. Ad-hoc scenarios use no Learning OS database." }, null, 2));
    return;
  }
  if (command === "adhoc-inspect" && value && extra) {
    if (!getAdhocTeacherScenario(value)) throw new Error(`Unknown ad-hoc teacher scenario: ${value}`);
    console.log(JSON.stringify(inspectAdhocTeacherReply(value, readFileSync(resolve(extra), "utf8")), null, 2));
    return;
  }
  if (command === "assessor-cases" && !value) {
    console.log(JSON.stringify({ cases: publicAssessorCases(), outputShape: {
      decisions: [{ caseId: "case id", action: "assess", result: "correct",
        criteriaMet: ["order", "mechanism"], criteriaUnmet: [] },
        { caseId: "case id", action: "clarify" }],
    } }, null, 2));
    return;
  }
  if (command === "grade-assessments" && value && !extra) {
    const score = scoreAssessorSubmission(JSON.parse(readFileSync(resolve(value), "utf8")));
    console.log(JSON.stringify(score, null, 2));
    if (score.passed !== score.total) process.exitCode = 1;
    return;
  }
  if (command === "metrics" && value && extra) {
    const db = new Database(resolve(value), { readonly: true, fileMustExist: true });
    try {
      console.log(JSON.stringify(summarizeDogfoodMetrics(db, { goalId: extra }), null, 2));
    } finally {
      db.close();
    }
    return;
  }
  if (command === "outcomes" && value) {
    // Read-only descriptive report; opens every database read-only and writes nothing.
    const knowledgeRoot = fileURLToPath(new URL("../../knowledge", import.meta.url));
    const report = summarizeLearningOutcomes(loadOutcomeManifest(value, knowledgeRoot), extra ? { asOf: extra } : {});
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  usage();
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
