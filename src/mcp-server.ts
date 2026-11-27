#!/usr/bin/env node
/**
 * Thin stdio Model Context Protocol (MCP) server for Learning OS.
 *
 * Exposes 5 coarse-grained tools (`study_next`, `study_submit`, `study_help`,
 * `study_status`, `study_notes`) over newline-delimited JSON-RPC 2.0 stdio with
 * zero additional runtime dependencies.
 */
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { OperationError, serializeOperationError } from "./errors.js";
import { callLearningOsTool, MCP_TOOLS } from "./mcp/tools.js";
import type { McpToolRuntimeContext } from "./mcp/tools.js";

const SERVER_INFO = {
  name: "learning-os",
  version: "0.1.0",
};

const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
]);
const DEFAULT_PROTOCOL_VERSION = "2025-03-26";

export function loadPackagedSkillInstructions(): string {
  const skillPath = fileURLToPath(new URL("../skills/learning-os-teacher/SKILL.md", import.meta.url));
  const raw = readFileSync(skillPath, "utf8");
  const stripped = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/u, "").trim();
  if (!stripped) {
    throw new Error(`Packaged teacher skill is empty: ${skillPath}`);
  }
  return stripped;
}

const SERVER_INSTRUCTIONS = loadPackagedSkillInstructions();

export interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function handleJsonRpcMessage(
  raw: unknown,
  context: McpToolRuntimeContext = {},
): JsonRpcResponse | null {
  if (!isObject(raw) || raw.jsonrpc !== "2.0" || typeof raw.method !== "string") {
    return {
      jsonrpc: "2.0",
      id: isObject(raw) && (typeof raw.id === "string" || typeof raw.id === "number") ? raw.id : null,
      error: { code: -32600, message: "Invalid JSON-RPC 2.0 request." },
    };
  }

  const hasId = Object.hasOwn(raw, "id") && raw.id !== undefined;
  const id = hasId ? (raw.id as string | number | null) : null;
  const method = raw.method;
  const params = isObject(raw.params) ? raw.params : {};

  // JSON-RPC notifications have no id and must not receive a response.
  if (!hasId) {
    return null;
  }

  switch (method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.has(requested)
        ? requested
        : DEFAULT_PROTOCOL_VERSION;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: {
            tools: {},
          },
          serverInfo: SERVER_INFO,
          instructions: SERVER_INSTRUCTIONS,
        },
      };
    }

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: MCP_TOOLS,
        },
      };

    case "tools/call": {
      const toolName = typeof params.name === "string" ? params.name : "";
      if (!toolName) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "tools/call requires params.name." },
        };
      }
      const toolArgs = params.arguments ?? {};
      try {
        const output = callLearningOsTool(toolName, toolArgs, context);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(output) }],
          },
        };
      } catch (error) {
        if (error instanceof OperationError && error.code === "UNKNOWN_TOOL") {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: error.message },
          };
        }
        const serialized = serializeOperationError(error, `mcp:${toolName}`);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            content: [{ type: "text", text: JSON.stringify(serialized) }],
          },
        };
      }
    }

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

export function startStdioServer(context: McpToolRuntimeContext = {}): void {
  const rl = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      const errResp: JsonRpcResponse = {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: invalid JSON." },
      };
      process.stdout.write(`${JSON.stringify(errResp)}\n`);
      return;
    }

    const response = handleJsonRpcMessage(parsed, context);
    if (response !== null) {
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  });
}

function isDirectEntrypoint(): boolean {
  if (!process.argv[1]) return false;
  try {
    const argvPath = realpathSync(resolve(process.argv[1]));
    const modulePath = realpathSync(fileURLToPath(import.meta.url));
    return argvPath === modulePath;
  } catch {
    return import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
  }
}

if (isDirectEntrypoint()) {
  startStdioServer();
}
