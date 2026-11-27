import { ZodError, type z } from "zod";

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
  expected?: string;
}

export class OperationError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable = false) {
    super(message);
    this.name = "OperationError";
  }
}

export class RequestValidationError extends OperationError {
  public readonly action?: string;
  public readonly issues: ValidationIssue[];

  constructor(
    message: string,
    issues: ValidationIssue[],
    options: { action?: string } = {},
  ) {
    super("INVALID_REQUEST", message, false);
    this.name = "RequestValidationError";
    this.issues = issues;
    if (options.action) this.action = options.action;
  }
}

export class PersistedStateValidationError extends OperationError {
  constructor(message = "Persisted state failed validation.") {
    super("VALIDATION_FAILED", message, false);
    this.name = "PersistedStateValidationError";
  }
}

function getValueAtPath(root: unknown, path: readonly PropertyKey[]): unknown {
  let current = root;
  for (const segment of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<PropertyKey, unknown>)[segment];
  }
  return current;
}

function allowlistedActionName(
  rawInput: unknown,
  actionKey?: string,
  allowedActions?: readonly string[],
): string | undefined {
  if (!actionKey || !allowedActions || allowedActions.length === 0) return undefined;
  if (typeof rawInput !== "object" || rawInput === null || Array.isArray(rawInput)) {
    return undefined;
  }
  const value = (rawInput as Record<string, unknown>)[actionKey];
  if (typeof value !== "string") return undefined;
  return allowedActions.includes(value) ? value : undefined;
}

function joinIssuePath(parentPath: string, childPath: string): string {
  if (!parentPath || parentPath === "<root>") return childPath || "<root>";
  if (!childPath || childPath === "<root>") return parentPath;
  return `${parentPath}.${childPath}`;
}

function selectMatchingUnionBranch(
  branches: ZodError["issues"][],
  valueAtUnion: unknown,
): ZodError["issues"] | null {
  if (branches.length === 0) return null;

  if (typeof valueAtUnion === "object" && valueAtUnion !== null && !Array.isArray(valueAtUnion)) {
    const obj = valueAtUnion as Record<string, unknown>;
    const discriminatorKeys = ["action", "kind", "questionChunking", "outcome", "scopeKind"];
    for (const key of discriminatorKeys) {
      if (typeof obj[key] === "string") {
        const matching = branches.filter(
          (branch) =>
            !branch.some(
              (sub) =>
                sub.path.length === 1 &&
                String(sub.path[0]) === key &&
                (sub.code === "invalid_value" || sub.code === "invalid_type"),
            ),
        );
        if (matching.length === 1) return matching[0]!;
        if (matching.length > 1) {
          return [...matching].sort((a, b) => a.length - b.length)[0]!;
        }
        // None of the union branches matched the supplied discriminator value —
        // let the caller emit a clean discriminator error rather than picking an unrelated branch.
        return null;
      }
    }
  }

  return [...branches].sort((a, b) => a.length - b.length)[0]!;
}

function collectAllowedDiscriminatorValues(
  branches: ZodError["issues"][],
  key: string,
): string[] {
  const values = new Set<string>();
  for (const branch of branches) {
    for (const sub of branch) {
      if (sub.path.length === 1 && String(sub.path[0]) === key && sub.code === "invalid_value") {
        const raw = sub as unknown as Record<string, unknown>;
        if (Array.isArray(raw.values)) {
          for (const val of raw.values) {
            if (typeof val === "string") values.add(val);
          }
        }
      }
    }
  }
  return [...values];
}

function sanitizeIssueList(
  issue: ZodError["issues"][number],
  rootInput: unknown,
  parentPath = "",
  parentSegments: readonly PropertyKey[] = [],
): ValidationIssue[] {
  const fullSegments = [...parentSegments, ...issue.path];
  const localPath = issue.path.length > 0 ? issue.path.map(String).join(".") : "";
  const path = joinIssuePath(parentPath, localPath);
  const raw = issue as unknown as Record<string, unknown>;

  if (issue.code === "invalid_union" && Array.isArray(raw.errors) && raw.errors.length > 0) {
    const branches = (raw.errors as unknown[]).filter(
      (branch): branch is ZodError["issues"] => Array.isArray(branch) && branch.length > 0,
    );
    const valueAtUnion = getValueAtPath(rootInput, fullSegments);
    const chosen = selectMatchingUnionBranch(branches, valueAtUnion);
    if (chosen) {
      return chosen.flatMap((sub) => sanitizeIssueList(sub, rootInput, path, fullSegments));
    }
    if (typeof valueAtUnion === "object" && valueAtUnion !== null && !Array.isArray(valueAtUnion)) {
      const obj = valueAtUnion as Record<string, unknown>;
      for (const key of ["action", "kind", "questionChunking", "outcome", "scopeKind"]) {
        if (typeof obj[key] === "string") {
          const allowed = collectAllowedDiscriminatorValues(branches, key);
          if (allowed.length > 0) {
            const expected = allowed.map((v) => JSON.stringify(v)).join(" | ");
            return [
              {
                path: joinIssuePath(path, key),
                code: "invalid_value",
                expected,
                message: `Expected one of: ${expected}.`,
              },
            ];
          }
        }
      }
    }
  }

  return [sanitizeLeafIssue(issue, path)];
}

function sanitizeLeafIssue(
  issue: ZodError["issues"][number],
  path: string,
): ValidationIssue {
  const raw = issue as unknown as Record<string, unknown>;

  if (issue.code === "invalid_type") {
    const expected = typeof raw.expected === "string" ? raw.expected : "valid value";
    return {
      path,
      code: issue.code,
      expected,
      message: `Expected ${expected}.`,
    };
  }
  if (issue.code === "invalid_value" && Array.isArray(raw.values)) {
    const allowed = raw.values.map((v) => JSON.stringify(v)).join(" | ");
    return {
      path,
      code: issue.code,
      expected: allowed,
      message: `Expected one of: ${allowed}.`,
    };
  }
  if (issue.code === "unrecognized_keys") {
    return {
      path,
      code: issue.code,
      message: "Unrecognized field(s) provided.",
    };
  }
  if (issue.code === "too_small") {
    const minimum = raw.minimum !== undefined ? String(raw.minimum) : "minimum";
    const origin = typeof raw.origin === "string" ? raw.origin : "value";
    const inclusive = raw.inclusive !== false;
    const op = inclusive ? ">=" : ">";
    const phrase = inclusive ? `minimum ${minimum}` : `greater than ${minimum}`;
    return {
      path,
      code: issue.code,
      expected: `${origin} ${op} ${minimum}`,
      message: `Too small: expected ${origin} ${phrase}.`,
    };
  }
  if (issue.code === "too_big") {
    const maximum = raw.maximum !== undefined ? String(raw.maximum) : "maximum";
    const origin = typeof raw.origin === "string" ? raw.origin : "value";
    const inclusive = raw.inclusive !== false;
    const op = inclusive ? "<=" : "<";
    const phrase = inclusive ? `maximum ${maximum}` : `less than ${maximum}`;
    return {
      path,
      code: issue.code,
      expected: `${origin} ${op} ${maximum}`,
      message: `Too large: expected ${origin} ${phrase}.`,
    };
  }
  if (issue.code === "invalid_union") {
    const discriminator = typeof raw.discriminator === "string" ? raw.discriminator : undefined;
    return {
      path,
      code: issue.code,
      ...(discriminator ? { expected: `valid ${discriminator} variant` } : {}),
      message: discriminator
        ? `Invalid or missing discriminator '${discriminator}'.`
        : "Input did not match any expected schema variant.",
    };
  }
  return {
    path,
    code: issue.code,
    message: "Invalid value for field.",
  };
}

/** Extract sanitized field-level validation issues without echoing raw learner text or unknown keys. */
export function formatZodValidationIssues(
  error: ZodError,
  rootInput?: unknown,
): ValidationIssue[] {
  return error.issues.flatMap((issue) => sanitizeIssueList(issue, rootInput));
}

/** Parse external tool/CLI input and throw actionable, privacy-safe RequestValidationError on failure. */
export function parseRequestInput<T>(
  schema: z.ZodType<T>,
  rawInput: unknown,
  options: { label: string; actionKey?: string; allowedActions?: readonly string[] },
): T {
  const result = schema.safeParse(rawInput);
  if (result.success) return result.data;
  const action = allowlistedActionName(rawInput, options.actionKey, options.allowedActions);
  if (
    options.actionKey &&
    options.allowedActions &&
    options.allowedActions.length > 0 &&
    action === undefined &&
    typeof rawInput === "object" &&
    rawInput !== null &&
    !Array.isArray(rawInput)
  ) {
    const expected = options.allowedActions.map((v) => JSON.stringify(v)).join(" | ");
    const issue: ValidationIssue = {
      path: options.actionKey,
      code: "invalid_value",
      expected,
      message: `Expected one of: ${expected}.`,
    };
    throw new RequestValidationError(
      `Invalid ${options.label} request: ${issue.path}: ${issue.message}`,
      [issue],
    );
  }
  const issues = formatZodValidationIssues(result.error, rawInput);
  const summary = issues
    .slice(0, 3)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join(" ");
  const prefix = action
    ? `Invalid ${options.label} request (${options.actionKey}='${action}'):`
    : `Invalid ${options.label} request:`;
  throw new RequestValidationError(`${prefix} ${summary}`, issues, { action });
}

/** Parse persisted database rows and throw PersistedStateValidationError on corruption/drift. */
export function parsePersistedRow<T>(schema: z.ZodType<T>, rawRow: unknown): T {
  const result = schema.safeParse(rawRow);
  if (result.success) return result.data;
  throw new PersistedStateValidationError("Persisted state failed validation.");
}

/** Machine-readable boundary errors without echoing raw request arguments. */
export function serializeOperationError(error: unknown, operation: string) {
  if (error instanceof RequestValidationError) {
    return {
      error: error.message,
      code: error.code,
      source: "request" as const,
      operation,
      retryable: false,
      ...(error.action ? { action: error.action } : {}),
      issues: error.issues,
    };
  }
  if (error instanceof PersistedStateValidationError) {
    return {
      error: error.message,
      code: error.code,
      source: "persisted_state" as const,
      operation,
      retryable: false,
    };
  }
  if (error instanceof OperationError) {
    return { error: error.message, code: error.code, operation, retryable: error.retryable };
  }
  if (error instanceof ZodError) {
    return {
      error: "Input or state failed validation.",
      code: "VALIDATION_FAILED",
      operation,
      retryable: false,
    };
  }
  const nativeCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
  const retryable = nativeCode === "SQLITE_BUSY" || nativeCode === "SQLITE_LOCKED" || nativeCode === "EAI_AGAIN";
  return {
    error: error instanceof Error ? error.message : "Operation failed.",
    code: retryable ? "RESOURCE_BUSY" : "OPERATION_FAILED", operation, retryable,
  };
}
