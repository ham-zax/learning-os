import { execFileSync, spawnSync, type SpawnSyncOptions } from "node:child_process";

/**
 * Blocking child-process helper for tests.
 *
 * `spawnSync` and `execFileSync` block the worker's event loop, so vitest's
 * `testTimeout` cannot interrupt them. A hung or severely contended child
 * wedges the worker, and every test queued behind that worker is then reported
 * as a timeout that has nothing to do with itself. Every blocking spawn in this
 * suite must therefore pass an explicit `timeout` and fail loudly instead.
 */

/**
 * Subprocess budgets must stay below the enclosing test's `testTimeout`.
 *
 * When a child hangs, the blocking spawn returns at its budget and reports a
 * named, attributable failure. If the budget were higher than the test timeout
 * instead, vitest would declare the timeout while the worker stayed blocked,
 * and every test queued behind that worker would be reported as a failure too.
 * Measured healthy costs: tsx CLI spawn ~0.6-1.2s, lesson script ~50ms.
 */
export const SPAWN_BUDGET_MS = 20_000;
export const EXEC_BUDGET_MS = 10_000;

function describeTimeout(options: { timeout?: number } | undefined, budget: number): number {
  const requested = options?.timeout ?? budget;
  if (requested > budget) {
    throw new Error(`Refusing unbounded subprocess timeout ${requested}ms; the budget is ${budget}ms.`);
  }
  return requested;
}

function assertCompleted(result: { error?: Error; signal?: NodeJS.Signals | null; status?: number | null }, label: string): void {
  if (result.error) {
    throw new Error(`${label} failed: ${result.error.message}`);
  }
  if (result.signal) {
    throw new Error(`${label} was killed by ${result.signal}; the subprocess budget was exceeded.`);
  }
  if (result.status === null) {
    throw new Error(`${label} did not report an exit status.`);
  }
}

export function runSync(command: string, args: readonly string[], options: SpawnSyncOptions = {}) {
  const timeout = describeTimeout(options, SPAWN_BUDGET_MS);
  const result = spawnSync(command, args as string[], { ...options, timeout });
  assertCompleted(result, `${command} ${args.join(" ")}`);
  return result;
}

export function runSource(source: string, options: { args?: readonly string[]; timeout?: number } = {}): string[] {
  const timeout = describeTimeout(options.timeout === undefined ? undefined : { timeout: options.timeout }, EXEC_BUDGET_MS);
  const output = execFileSync(
    process.execPath,
    [...(options.args ?? ["--input-type=module", "--eval", source])],
    { encoding: "utf8", timeout, maxBuffer: 64 * 1024 },
  );
  return output.trim().split(/\r?\n/);
}

export function runFile(file: string, options: { timeout?: number } = {}): string[] {
  const timeout = describeTimeout(options.timeout === undefined ? undefined : { timeout: options.timeout }, EXEC_BUDGET_MS);
  return execFileSync(process.execPath, [file], { encoding: "utf8", timeout, maxBuffer: 64 * 1024 })
    .trim()
    .split(/\r?\n/);
}