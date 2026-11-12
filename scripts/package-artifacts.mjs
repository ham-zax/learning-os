// tsconfig.json compiles tracked src/**/*.ts with rootDir=src, outDir=dist,
// declaration/declarationMap/sourceMap enabled. No other dist files are public.
const generatedSuffixes = [".js", ".js.map", ".d.ts", ".d.ts.map"];

export function expectedCompiledFiles(trackedFiles) {
  const expected = new Set();
  for (const source of trackedFiles) {
    if (!source.startsWith("src/") || !source.endsWith(".ts") || source.endsWith(".d.ts")) {
      continue;
    }
    const stem = source.slice("src/".length, -".ts".length);
    for (const suffix of generatedSuffixes) {
      expected.add(`dist/${stem}${suffix}`);
    }
  }
  return expected;
}

// Validate the exact npm pack file list, not just the local dist directory.
export function compiledPackageProblems(packageFiles, trackedFiles) {
  const expected = expectedCompiledFiles(trackedFiles);
  const packed = new Set(packageFiles.filter((path) => path.startsWith("dist/")));
  return {
    unexpected: [...packed].filter((path) => !expected.has(path)).sort(),
    missing: [...expected].filter((path) => !packed.has(path)).sort(),
  };
}
