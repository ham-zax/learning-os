import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createConcept, createDatabase, createGoal, createTopic, setGoalObjective } from "../src/db/database.js";
import { createLearningObjective } from "../src/kernel/foundation.js";
import { createLearningOsHttpServer } from "../src/mcp-http.js";
import { createProfile, selectProfile } from "../src/profile/index.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const knowledgeRoot = join(repoRoot, "knowledge");

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()!();
  }
});

async function startTestServer(options: Parameters<typeof createLearningOsHttpServer>[0] = {}) {
  const server = createLearningOsHttpServer(options);
  await new Promise<void>((res) => server.listen(0, "127.0.0.1", () => res()));
  const { port } = server.address() as AddressInfo;
  cleanups.push(
    () =>
      new Promise<void>((res, rej) => {
        server.close((err) => (err ? rej(err) : res()));
      }),
  );
  return { baseUrl: `http://127.0.0.1:${port}` };
}

function seedManagedDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "learning-os-http-mcp-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const dataDir = join(dir, "data");
  createProfile({ id: "demo", displayName: "Demo" }, { dataDir });
  selectProfile("demo", { dataDir });
  const dbPath = join(dataDir, "profiles", "demo", "tutor.db");
  const db = createDatabase(dbPath);
  try {
    createTopic(db, { id: "js", name: "JavaScript" });
    createConcept(db, { id: "js-closures", topicId: "js", title: "Closures" });
    createLearningObjective(db, { id: "js-closures:explain", conceptId: "js-closures", capabilityId: "explain" });
    createGoal(db, { id: "goal-demo", name: "Demo Goal", purpose: "interview" });
    setGoalObjective(db, { goalId: "goal-demo", objectiveId: "js-closures:explain", importance: "core" });
  } finally {
    db.close();
  }
  return dataDir;
}

describe("Learning OS Streamable HTTP MCP server", () => {
  it("handles initialize, notification 202, tools/list, tools/call, SSE-only Accept, GET 405, DELETE 204, and blocks raw dbPath by default", async () => {
    const dataDir = seedManagedDataDir();
    const secretPath = "/secret-token-xyz/mcp";
    const { baseUrl } = await startTestServer({
      endpointPath: secretPath,
      context: { dataDir, knowledgeRoot },
    });

    // Wrong path returns 404; health returns 200
    expect((await fetch(`${baseUrl}/mcp`, { method: "POST", body: "{}" })).status).toBe(404);
    expect((await fetch(`${baseUrl}/health`)).status).toBe(200);

    // GET on MCP endpoint returns 405
    expect((await fetch(`${baseUrl}${secretPath}`, { method: "GET" })).status).toBe(405);

    // Initialize negotiates protocol version and sets Mcp-Session-Id + packaged instructions
    const initRes = await fetch(`${baseUrl}${secretPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18" },
      }),
    });
    expect(initRes.status).toBe(200);
    const sessionId = initRes.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();
    const initBody = (await initRes.json()) as { result: { protocolVersion: string; instructions: string } };
    expect(initBody.result.protocolVersion).toBe("2025-06-18");
    expect(initBody.result.instructions).toContain("study_next");

    // Notification returns 202 Accepted with empty body
    const notifRes = await fetch(`${baseUrl}${secretPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Mcp-Session-Id": sessionId! },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    expect(notifRes.status).toBe(202);

    // tools/list returns all 5 tools
    const listRes = await fetch(`${baseUrl}${secretPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Mcp-Session-Id": sessionId! },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    const listBody = (await listRes.json()) as { result: { tools: Array<{ name: string }> } };
    expect(listBody.result.tools.map((t) => t.name)).toEqual([
      "study_next",
      "study_submit",
      "study_help",
      "study_status",
      "study_notes",
    ]);

    // Managed profile study_next works
    const nextRes = await fetch(`${baseUrl}${secretPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Mcp-Session-Id": sessionId! },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "study_next", arguments: { profile: "demo", oneEpisode: true } },
      }),
    });
    const nextBody = (await nextRes.json()) as { result: { content: Array<{ text: string }> } };
    expect(JSON.parse(nextBody.result.content[0]!.text)).toMatchObject({
      profile: "demo",
      continuation: { kind: "recommend", item: { objectiveId: "js-closures:explain" } },
    });

    // Direct dbPath is rejected over HTTP by default
    const rawDbRes = await fetch(`${baseUrl}${secretPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "study_status", arguments: { dbPath: "/tmp/should-be-blocked.db" } },
      }),
    });
    const rawDbBody = (await rawDbRes.json()) as { result: { isError: boolean; content: Array<{ text: string }> } };
    expect(rawDbBody.result.isError).toBe(true);
    expect(rawDbBody.result.content[0]!.text).toContain("Direct dbPath access is disabled");

    // SSE-only Accept wraps JSON-RPC response in text/event-stream
    const sseRes = await fetch(`${baseUrl}${secretPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "ping" }),
    });
    expect(sseRes.headers.get("content-type")).toContain("text/event-stream");
    expect(await sseRes.text()).toContain('data: {"jsonrpc":"2.0","id":5,"result":{}}');

    // DELETE closes session with 204
    expect((await fetch(`${baseUrl}${secretPath}`, { method: "DELETE", headers: { "Mcp-Session-Id": sessionId! } })).status).toBe(204);
  });

  it("enforces Bearer auth when configured and rejects invalid JSON with 400", async () => {
    const { baseUrl } = await startTestServer({
      endpointPath: "/mcp",
      bearerToken: "top-secret-bearer",
    });

    expect((await fetch(`${baseUrl}/mcp`, { method: "POST", body: "{}" })).status).toBe(401);
    expect(
      (
        await fetch(`${baseUrl}/mcp`, {
          method: "POST",
          headers: { Authorization: "Bearer wrong-token", "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
    ).toBe(401);

    const badJson = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { Authorization: "Bearer top-secret-bearer", "Content-Type": "application/json" },
      body: "{not-json",
    });
    expect(badJson.status).toBe(400);

    const okPing = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { Authorization: "Bearer top-secret-bearer", "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    expect(okPing.status).toBe(200);
    expect(await okPing.json()).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
  });
});
