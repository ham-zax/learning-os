import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

export interface PublicFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

const CAPS = { timeoutMs: 30_000, maxBytes: 2 * 1024 * 1024, maxRedirects: 5 };

// Conservative public-unicast policy. IPv6 transition mechanisms and special
// assignments are excluded too, rather than trusting their embedded destination.
function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) !== 6 || address.includes("%") || address.includes(".")) return false;
  const [left, right] = address.toLowerCase().split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const parts = right === undefined ? start : [...start, ...Array(8 - start.length - end.length).fill("0"), ...end];
  const first = parseInt(parts[0], 16);
  const second = parseInt(parts[1], 16);
  return first >= 0x2000 && first <= 0x3fff &&
    !(first === 0x2001 && (second <= 0x1ff || second === 0xdb8)) &&
    first !== 0x2002 && !(first === 0x3fff && second <= 0xfff);
}

function validatedUrl(input: string): URL {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error("URL ingestion requires HTTP(S) without credentials");
  }
  return url;
}

/** Fetch UTF-8 text from public addresses with a pinned DNS result per hop.
 * Limits apply to the entire operation, including DNS and redirects. Responses
 * are not decompressed, so compressed payloads cannot bypass the byte limit.
 */
export async function fetchPublicText(input: string, options: PublicFetchOptions = {}): Promise<string> {
  const limits = { ...CAPS, ...options };
  for (const key of Object.keys(CAPS) as (keyof typeof CAPS)[]) {
    if (!Number.isSafeInteger(limits[key]) || limits[key] < (key === "maxRedirects" ? 0 : 1) || limits[key] > CAPS[key]) {
      throw new Error(`Invalid URL ingestion limit: ${key}`);
    }
  }
  const controller = new AbortController();
  const timeoutError = new Error("URL ingestion timed out");
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(timeoutError); }, limits.timeoutMs);
  });
  const fetch = async (): Promise<string> => {
    let url = validatedUrl(input);
    for (let redirects = 0; ; redirects++) {
      const hostname = url.hostname.replace(/^\[|\]$/g, "");
      const addresses = isIP(hostname)
        ? [{ address: hostname, family: isIP(hostname) }]
        : await lookup(hostname, { all: true, verbatim: true });
      controller.signal.throwIfAborted();
      if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) {
        throw new Error("URL ingestion blocked a non-public address");
      }
      const pinned = addresses[0];
      const result = await new Promise<{ text?: string; location?: string }>((resolve, reject) => {
        const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
          agent: false,
          signal: controller.signal,
          headers: { "accept-encoding": "identity" },
          // Keep the original hostname for HTTP Host and TLS validation, but
          // never perform another DNS lookup when opening the socket.
          lookup: (_hostname, options, callback) => {
            if (options.all) callback(null, [pinned]);
            else callback(null, pinned.address, pinned.family);
          },
        }, response => {
          const status = response.statusCode ?? 0;
          if ([301, 302, 303, 307, 308].includes(status)) {
            const location = response.headers.location;
            response.destroy();
            if (!location) reject(new Error("URL redirect has no location"));
            else resolve({ location });
            return;
          }
          if (status < 200 || status >= 300) {
            response.destroy();
            reject(new Error(`URL ingestion failed with HTTP ${status}`));
            return;
          }
          if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
            response.destroy();
            reject(new Error("URL ingestion does not accept compressed responses"));
            return;
          }
          const chunks: Buffer[] = [];
          let bytes = 0;
          response.on("error", reject);
          response.on("aborted", () => reject(new Error("URL response was interrupted")));
          response.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > limits.maxBytes) {
              reject(new Error("URL response exceeds byte limit"));
              response.destroy();
              request.destroy();
            } else chunks.push(chunk);
          });
          response.on("end", () => resolve({ text: Buffer.concat(chunks).toString("utf8") }));
        });
        request.on("error", reject);
        request.setTimeout(limits.timeoutMs, () => request.destroy(timeoutError));
        request.end();
      });
      if (result.location === undefined) return result.text!;
      if (redirects >= limits.maxRedirects) throw new Error("URL ingestion exceeded redirect limit");
      url = validatedUrl(new URL(result.location, url).href);
    }
  };
  try { return await Promise.race([fetch(), timeout]); }
  finally { clearTimeout(timer!); }
}
