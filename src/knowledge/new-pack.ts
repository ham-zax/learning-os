/**
 * Scaffold a calibrated prediction pack:
 *   npm run pack:new -- <course> <concept-id>
 *
 * Creates knowledge/<course>/challenges/<concept-id>-predict/ with a draft calibration.json
 * skeleton, three case files and a README. Fill them in, remove `"draft": true`, then run
 * `npx vitest run tests/calibrated-packs.test.ts`; it executes every non-draft case and
 * fails until each answer key matches real output. Teachers never see a draft pack.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const knowledgeRoot = fileURLToPath(new URL("../../knowledge", import.meta.url));
const [course, conceptId] = process.argv.slice(2);

if (!course || !conceptId) {
  console.error("Usage: npm run pack:new -- <course> <concept-id>");
  process.exit(1);
}
if (!existsSync(join(knowledgeRoot, course, "concepts", `${conceptId}.md`))) {
  console.error(`No concept knowledge/${course}/concepts/${conceptId}.md`);
  process.exit(1);
}

const packId = `${conceptId}-predict`;
const directory = join(knowledgeRoot, course, "challenges", packId);
if (existsSync(directory)) {
  console.error(`Pack already exists: ${directory}`);
  process.exit(1);
}

const cases = [
  { id: "baseline", novelty: "same", source: "baseline.mjs" },
  { id: "variant", novelty: "variant", source: "variant.mjs" },
  { id: "transfer", novelty: "transfer", source: "transfer.mjs" },
] as const;

const calibration = {
  draft: true,
  objective: { conceptId, capabilityId: "predict", taskForm: "runtime_trace" },
  environment: "This is Node.js ESM code with no external packages. Predict before running it; we can run it after your answer.",
  cases: cases.map((item) => ({
    id: item.id,
    novelty: item.novelty,
    surface: `TODO: one line naming this case's code surface (${item.novelty})`,
    source: item.source,
    question: "TODO: ask for the exact output and the reason for the decisive boundary.",
    criteria: [
      { id: "output_order", required: true, description: "TODO: the exact output the learner must predict." },
      { id: "mechanism", required: true, description: "TODO: the causal relationship the learner must explain." },
    ],
    expectedOutput: ["TODO"],
    wrongModels: [
      { claim: "TODO: a plausible faulty model a rusty learner holds.", predictedOutput: ["TODO-wrong"] },
    ],
  })),
};

mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, "calibration.json"), `${JSON.stringify(calibration, null, 2)}\n`);
for (const item of cases) {
  writeFileSync(join(directory, item.source),
    `// ${item.novelty}: keep it short, deterministic and runnable with plain \`node\`.\nconsole.log("TODO");\n`);
}
writeFileSync(join(directory, "README.md"), `# Calibrated prediction examples: \`${conceptId}:predict\`

Teacher-only examples for [${conceptId}](../../concepts/${conceptId}.md). The answer keys and wrong models are in \`calibration.json\`; the \`.mjs\` files are the exact code a learner may see.

Use a case only after Learning OS selects a matching \`predict\` / \`runtime_trace\` intent. Find it with \`findCalibratedPredictionCase(...)\`, build it with \`buildCalibratedPredictionChallenge(...)\`, freeze it, ask for the prediction and stop. Run the file after the learner commits. Never show \`expectedOutput\` or \`wrongModels\`.

TODO: one paragraph naming the wrong models these cases tell apart, and what each case adds.
`);

console.log(`Created ${directory}`);
console.log("Next: write the three cases, fill calibration.json, remove \"draft\": true,");
console.log("link the README from the concept and unit docs, then run: npx vitest run tests/calibrated-packs.test.ts");
