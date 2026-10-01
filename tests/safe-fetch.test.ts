import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:http", () => ({ request: mocks.request }));
vi.mock("node:https", () => ({ request: mocks.request }));
import { fetchPublicText } from "../src/ingest/safe-fetch.js";

function response(statusCode: number, chunks: string[] = [], headers = {}) {
  return Object.assign(Readable.from(chunks.map(chunk => Buffer.from(chunk))), { statusCode, headers });
}

function serve(...responses: ReturnType<typeof response>[]) {
  mocks.request.mockImplementation((_url, options, callback) => {
    const req = Object.assign(new EventEmitter(), {
      setTimeout: vi.fn(),
      destroy: vi.fn(),
      end: () => queueMicrotask(() => callback(responses.shift()!)),
    });
    options.signal.addEventListener("abort", () => req.emit("error", new Error("aborted")), { once: true });
    return req;
  });
}

beforeEach(() => {
  mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe("public URL ingestion", () => {
  it.each([
    "http://127.0.0.1", "http://127.1", "http://0x7f000001", "http://2130706433",
    "http://0.0.0.0", "http://10.0.0.1", "http://172.16.1.2", "http://192.168.1.1",
    "http://169.254.169.254", "http://100.64.0.1", "http://224.0.0.1", "http://240.1.1.1",
    "http://192.0.2.1", "http://198.18.0.1", "http://198.51.100.1", "http://203.0.113.1",
    "http://[::1]", "http://[::]", "http://[fc00::1]", "http://[fe80::1]", "http://[ff02::1]",
    "http://[::ffff:127.0.0.1]", "http://[::ffff:0808:0808]", "http://[64:ff9b::a00:1]",
    "http://[2002:7f00:1::]", "http://[2001:db8::1]", "http://[3fff::1]",
  ])("blocks special address %s before requesting it", async url => {
    await expect(fetchPublicText(url)).rejects.toThrow("non-public");
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it.each(["file:///etc/passwd", "ftp://example.com", "http://user:password@example.com"])("blocks invalid URL %s", async url => {
    await expect(fetchPublicText(url)).rejects.toThrow("HTTP(S)");
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("checks every DNS result and blocks mixed public/private answers", async () => {
    mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }]);
    await expect(fetchPublicText("https://example.com")).rejects.toThrow("non-public");
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("pins the vetted DNS address and preserves the TLS hostname", async () => {
    serve(response(200, ["hello ", "world"]));
    await expect(fetchPublicText("https://example.com/path")).resolves.toBe("hello world");
    const [url, options] = mocks.request.mock.calls[0];
    expect(url.hostname).toBe("example.com");
    expect(options.agent).toBe(false);
    const callback = vi.fn();
    options.lookup("example.com", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    options.lookup("example.com", { all: true }, callback);
    expect(callback).toHaveBeenLastCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
  });

  it("accepts public IPv6 and pins its address", async () => {
    serve(response(200, ["ipv6"]));
    await expect(fetchPublicText("https://[2606:4700:4700::1111]")).resolves.toBe("ipv6");
    const callback = vi.fn();
    mocks.request.mock.calls[0][1].lookup("ignored", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "2606:4700:4700::1111", 6);
  });

  it("validates redirect destinations before connecting", async () => {
    serve(response(302, [], { location: "http://169.254.169.254/metadata" }));
    await expect(fetchPublicText("https://example.com")).rejects.toThrow("non-public");
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it("checks DNS again for relative redirects", async () => {
    serve(response(302, [], { location: "/next" }));
    mocks.lookup.mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    await expect(fetchPublicText("https://example.com")).rejects.toThrow("non-public");
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it("follows relative redirects within the budget", async () => {
    serve(response(302, [], { location: "/next" }), response(200, ["done"]));
    await expect(fetchPublicText("https://example.com")).resolves.toBe("done");
    expect(mocks.request.mock.calls[1][0].href).toBe("https://example.com/next");
  });

  it("bounds redirects", async () => {
    serve(response(302, [], { location: "/next" }));
    await expect(fetchPublicText("https://example.com", { maxRedirects: 0 })).rejects.toThrow("redirect limit");
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it("counts UTF-8 bytes and destroys oversized responses", async () => {
    const body = response(200, ["éé", "é"]);
    serve(body);
    await expect(fetchPublicText("https://example.com", { maxBytes: 5 })).rejects.toThrow("byte limit");
    expect(body.destroyed).toBe(true);
    expect(mocks.request.mock.results[0].value.destroy).toHaveBeenCalled();
  });

  it("rejects HTTP errors and compressed bodies", async () => {
    serve(response(500), response(200, ["compressed"], { "content-encoding": "gzip" }));
    await expect(fetchPublicText("https://example.com")).rejects.toThrow("HTTP 500");
    await expect(fetchPublicText("https://example.com")).rejects.toThrow("compressed");
  });

  it("bounds DNS time and prevents late DNS completion from opening a socket", async () => {
    vi.useFakeTimers();
    let complete!: (value: unknown) => void;
    mocks.lookup.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const result = expect(fetchPublicText("https://example.com", { timeoutMs: 10 })).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(10);
    await result;
    complete([{ address: "8.8.8.8", family: 4 }]);
    await Promise.resolve();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("aborts an outstanding response at the total deadline", async () => {
    vi.useFakeTimers();
    serve(Object.assign(new Readable({ read() {} }), { statusCode: 200, headers: {} }));
    const result = expect(fetchPublicText("https://example.com", { timeoutMs: 10 })).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10);
    await result;
    expect(mocks.request.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it.each([{ timeoutMs: 30_001 }, { maxBytes: 2 * 1024 * 1024 + 1 }, { maxRedirects: 6 }, { timeoutMs: 0 }, { maxBytes: NaN }, { maxRedirects: -1 }])("forbids unbounded options %j", async options => {
    await expect(fetchPublicText("https://example.com", options)).rejects.toThrow("limit");
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
