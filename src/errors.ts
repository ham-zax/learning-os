import { ZodError } from "zod";

export class OperationError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable = false) {
    super(message);
    this.name = "OperationError";
  }
}

/** Machine-readable boundary errors without echoing raw request arguments. */
export function serializeOperationError(error: unknown, operation: string) {
  if (error instanceof OperationError) {
    return { error: error.message, code: error.code, operation, retryable: error.retryable };
  }
  if (error instanceof ZodError) {
    return { error: "Input or persisted state failed validation.", code: "VALIDATION_FAILED", operation, retryable: false };
  }
  const nativeCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
  const retryable = nativeCode === "SQLITE_BUSY" || nativeCode === "SQLITE_LOCKED" || nativeCode === "EAI_AGAIN";
  return {
    error: error instanceof Error ? error.message : "Operation failed.",
    code: retryable ? "RESOURCE_BUSY" : "OPERATION_FAILED", operation, retryable,
  };
}
