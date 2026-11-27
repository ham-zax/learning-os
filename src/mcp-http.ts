#!/usr/bin/env node
/**
 * Streamable HTTP Model Context Protocol (MCP) server for Learning OS.
 *
 * Wraps the shared 5-tool JSON-RPC handler (`handleJsonRpcMessage`) over Node's
 * built-in `node:http` server with zero runtime dependencies so remote clients
 * (Gemini custom Connected Apps, ChatGPT, MCP Inspector, etc.) can connect over
 * HTTPS via a reverse proxy such as Caddy.
 */
import { randomUUID, timingSafeEqual } from "node:crypto";
import { realpathSync } from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { handleJsonRpcMessage } from "./mcp-server.js";
import type { McpToolRuntimeContext } from "./mcp/tools.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3090;
const DEFAULT_ENDPOINT_PATH = "/mcp";
const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB

export interface McpHttpServerOptions {
  host?: string;
  port?: number;
  endpointPath?: string;
  bearerToken?: string;
  context?: McpToolRuntimeContext;
}

function normalizeEndpointPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) return DEFAULT_ENDPOINT_PATH;
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.length > 1 && withLeading.endsWith("/")
    ? withLeading.slice(0, -1)
    : withLeading;
}

function constantTimeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isAuthorized(req: IncomingMessage, bearerToken?: string): boolean {
  if (!bearerToken) return true;
  const header = req.headers.authorization;
  if (typeof header !== "string") return false;
  const match = header.match(/^Bearer\s+(.+)$/iu);
  if (!match) return false;
  return constantTimeEquals(match[1]!.trim(), bearerToken);
}

function readBody(req: IncomingMessage, limitBytes: number): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    req.on("data", (chunk: Buffer) => {
      if (settled) return;
      total += chunk.length;
      if (total > limitBytes) {
        settled = true;
        rejectBody(Object.assign(new Error("Request body too large."), { statusCode: 413 }));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      rejectBody(err);
    });
  });
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    ...extraHeaders,
  });
  res.end(body);
}

function wantsSseOnly(req: IncomingMessage): boolean {
  const accept = typeof req.headers.accept === "string" ? req.headers.accept.toLowerCase() : "";
  return accept.includes("text/event-stream") && !accept.includes("application/json") && !accept.includes("*/*");
}

function sendMcpPayload(
  req: IncomingMessage,
  res: ServerResponse,
  payload: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  if (wantsSseOnly(req)) {
    const body = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      ...extraHeaders,
    });
    res.end(body);
    return;
  }
  sendJson(res, 200, payload, extraHeaders);
}

export function createLearningOsHttpServer(options: McpHttpServerOptions = {}): Server {
  const endpointPath = normalizeEndpointPath(options.endpointPath ?? DEFAULT_ENDPOINT_PATH);
  const bearerToken = options.bearerToken?.trim() || undefined;
  const runtimeContext: McpToolRuntimeContext = {
    allowDbPath: false,
    ...options.context,
  };
  const activeSessions = new Set<string>();

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname =
      url.pathname.length > 1 && url.pathname.endsWith("/")
        ? url.pathname.slice(0, -1)
        : url.pathname;

    if (req.method === "GET" && pathname === "/health") {
      sendJson(res, 200, { status: "ok", service: "learning-os-mcp" });
      return;
    }

    if (pathname !== endpointPath) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        Allow: "POST, DELETE, OPTIONS",
        "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
        "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
      });
      res.end();
      return;
    }

    if (!isAuthorized(req, bearerToken)) {
      sendJson(res, 401, { error: "Unauthorized" }, { "WWW-Authenticate": 'Bearer realm="learning-os-mcp"' });
      return;
    }

    if (req.method === "GET") {
      res.writeHead(405, {
        Allow: "POST, DELETE, OPTIONS",
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify({ error: "Method Not Allowed: server does not open standalone SSE streams." }));
      return;
    }

    if (req.method === "DELETE") {
      const sessionId = req.headers["mcp-session-id"];
      if (typeof sessionId === "string") {
        activeSessions.delete(sessionId);
      }
      res.writeHead(204, { "Cache-Control": "no-store" });
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, {
        Allow: "POST, DELETE, OPTIONS",
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    let rawBody: string;
    try {
      rawBody = await readBody(req, MAX_BODY_BYTES);
    } catch (err) {
      const statusCode =
        typeof err === "object" && err !== null && "statusCode" in err
          ? Number((err as { statusCode: unknown }).statusCode)
          : 400;
      sendJson(res, statusCode, {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: err instanceof Error ? err.message : "Failed to read request body." },
      });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: invalid JSON." },
      });
      return;
    }

    const extraHeaders: Record<string, string> = {};
    const existingSessionId =
      typeof req.headers["mcp-session-id"] === "string" ? req.headers["mcp-session-id"] : undefined;
    if (existingSessionId) {
      extraHeaders["Mcp-Session-Id"] = existingSessionId;
    }

    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        sendJson(res, 400, {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Invalid JSON-RPC batch: empty array." },
        });
        return;
      }
      const responses = parsed
        .map((msg) => handleJsonRpcMessage(msg, runtimeContext))
        .filter((resp): resp is NonNullable<typeof resp> => resp !== null);
      if (responses.length === 0) {
        res.writeHead(202, { "Cache-Control": "no-store", ...extraHeaders });
        res.end();
        return;
      }
      sendMcpPayload(req, res, responses, extraHeaders);
      return;
    }

    const response = handleJsonRpcMessage(parsed, runtimeContext);
    if (response === null) {
      res.writeHead(202, { "Cache-Control": "no-store", ...extraHeaders });
      res.end();
      return;
    }

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "method" in parsed &&
      (parsed as { method?: unknown }).method === "initialize" &&
      response.result &&
      typeof response.result === "object"
    ) {
      const newSessionId = existingSessionId ?? randomUUID();
      activeSessions.add(newSessionId);
      extraHeaders["Mcp-Session-Id"] = newSessionId;
      const negotiated = (response.result as { protocolVersion?: unknown }).protocolVersion;
      if (typeof negotiated === "string") {
        extraHeaders["MCP-Protocol-Version"] = negotiated;
      }
    }

    sendMcpPayload(req, res, response, extraHeaders);
  });
}

function startFromEnv(): void {
  const host = process.env.LEARNING_OS_MCP_HOST?.trim() || DEFAULT_HOST;
  const rawPort = process.env.LEARNING_OS_MCP_PORT?.trim();
  const port = rawPort ? Number.parseInt(rawPort, 10) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid LEARNING_OS_MCP_PORT: ${String(rawPort)}`);
  }

  const secretSegment = process.env.LEARNING_OS_MCP_PATH_SECRET?.trim();
  const endpointPath = process.env.LEARNING_OS_MCP_PATH?.trim()
    ? process.env.LEARNING_OS_MCP_PATH.trim()
    : secretSegment
      ? `/${secretSegment}/mcp`
      : DEFAULT_ENDPOINT_PATH;

  const bearerToken = process.env.LEARNING_OS_MCP_BEARER_TOKEN?.trim() || undefined;
  const allowDbPath = process.env.LEARNING_OS_MCP_ALLOW_DB_PATH === "1";

  const context: McpToolRuntimeContext = {
    allowDbPath,
    ...(process.env.LEARNING_OS_DATA_DIR ? { dataDir: resolve(process.env.LEARNING_OS_DATA_DIR) } : {}),
    ...(process.env.LEARNING_OS_KNOWLEDGE_ROOT
      ? { knowledgeRoot: resolve(process.env.LEARNING_OS_KNOWLEDGE_ROOT) }
      : {}),
  };

  const server = createLearningOsHttpServer({
    host,
    port,
    endpointPath,
    bearerToken,
    context,
  });

  server.listen(port, host, () => {
    const authMode = bearerToken ? "bearer" : secretSegment ? "secret-path" : "open";
    process.stderr.write(
      `learning-os Streamable HTTP MCP listening on http://${host}:${port} (auth=${authMode}, allowDbPath=${allowDbPath})\n`,
    );
  });
}

const isDirectEntry =
  process.argv[1] !== undefined &&
  (() => {
    try {
      return pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
    } catch {
      return false;
    }
  })();

if (isDirectEntry) {
  startFromEnv();
}
