import assert from "node:assert/strict";
import test from "node:test";
import { compiledPackageProblems, expectedCompiledFiles } from "./package-artifacts.mjs";

const sources = ["src/cli.ts", "src/kernel/teacher.ts", "src/types.d.ts"];
const validFiles = [...expectedCompiledFiles(sources)];

test("only tracked TypeScript modules produce allowed compiled artifacts", () => {
  assert.equal(validFiles.length, 8);
  assert.ok(validFiles.includes("dist/cli.js"));
  assert.ok(validFiles.includes("dist/kernel/teacher.d.ts.map"));
  assert.ok(!validFiles.some((file) => file.includes("types.d")));
  assert.deepEqual(compiledPackageProblems(validFiles, sources), {
    unexpected: [],
    missing: [],
  });
});

test("a retired compiled module cannot enter the package", () => {
  const files = [...validFiles, "dist/interview/retired.js", "dist/interview/retired.js.map"];
  assert.deepEqual(compiledPackageProblems(files, sources), {
    unexpected: ["dist/interview/retired.js", "dist/interview/retired.js.map"],
    missing: [],
  });
});

test("unexpected non-JavaScript artifacts are also rejected", () => {
  const result = compiledPackageProblems([...validFiles, "dist/legacy.txt"], sources);
  assert.deepEqual(result.unexpected, ["dist/legacy.txt"]);
});

test("missing build outputs fail package verification", () => {
  const result = compiledPackageProblems(validFiles.filter((path) => path !== "dist/cli.js"), sources);
  assert.deepEqual(result, { unexpected: [], missing: ["dist/cli.js"] });
});

test("other tracked package resources are not compiled artifacts", () => {
  const result = compiledPackageProblems([...validFiles, "knowledge/manifest.json"], sources);
  assert.deepEqual(result, { unexpected: [], missing: [] });
});
