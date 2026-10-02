import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { publicAssessorCases, scoreAssessorSubmission } from "./assessment-calibration.js";
import { summarizeDogfoodMetrics } from "./dogfood-metrics.js";
import { loadOutcomeManifest, summarizeLearningOutcomes } from "./learning-outcomes.js";
import {
  inspectTeacherScenario,
  prepareTeacherScenario,
  teacherScenarios,
  type PreparedTeacherScenario,
  type TeacherScenarioId,
} from "./teacher-scenarios.js";

function usage(): never {
  throw new Error("Usage: npm run eval:teacher -- <list | prepare CASE_ID [DIRECTORY] | inspect DIRECTORY | assessor-cases | grade-assessments FILE | metrics DATABASE GOAL_ID | outcomes MANIFEST [AS_OF]>");
}

function main(args: string[]): void {
  const [command, value, extra] = args;
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
  if (command === "inspect" && value && !extra) {
    const dir = resolve(value);
    const manifest = JSON.parse(readFileSync(join(dir, "scenario.json"), "utf8")) as { prepared: PreparedTeacherScenario };
    const scenario = teacherScenarios.find((item) => item.id === manifest.prepared.id);
    if (!scenario) throw new Error(`Unknown teacher scenario in manifest: ${manifest.prepared.id}`);
    const checks = inspectTeacherScenario(join(dir, "tutor.db"), manifest.prepared);
    console.log(JSON.stringify({ caseId: scenario.id, automatedChecks: checks,
      passed: checks.filter((item) => item.passed).length, total: checks.length,
      reviewerChecks: scenario.review,
      limitation: "Database checks cannot establish whether the teacher's question was neutral, feedback was accurate, or exposure was shown immediately after recording." }, null, 2));
    if (checks.some((item) => !item.passed)) process.exitCode = 1;
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

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
