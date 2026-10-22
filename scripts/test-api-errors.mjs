import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "../apps/web/node_modules/typescript/lib/typescript.js";
const requireWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const Module = requireWeb("node:module");
const src = await readFile(new URL("../apps/web/src/lib/api.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
let token = null;
let tokenLookup = async () => token;
const mod = new Module("api-error-regression");
mod.require = name => name === "./constants" ? { API_BASE_URL: "http://localhost:8000" }
  : name === "./auth" ? { getAuthToken: () => tokenLookup(), clearSession: () => { token = null; } }
  : requireWeb(name);
mod._compile(compiled, "api-error-regression");
const api = mod.exports;
const originalFetch = globalThis.fetch;
const originalTimer = globalThis.setTimeout;
try {
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  for (const call of [() => api.healthCheck(), () => api.extractFromImage(new File(["test"], "scan.jpg")), () => api.transcribeAudio(new Blob(["test"]))]) {
    await assert.rejects(call(), /Unable to reach the medicine service/);
  }
  globalThis.fetch = async () => new Response("<html>proxy down</html>", { status: 503 });
  await assert.rejects(api.healthCheck(), /temporarily unavailable.*503/);
  globalThis.fetch = async () => Response.json({ detail: [{ loc: ["body", "rating"], msg: "Input should be less than or equal to 5" }] }, { status: 422 });
  await assert.rejects(api.healthCheck(), /Input should be less than or equal to 5/);
  globalThis.fetch = async () => new Response("not-json", { status: 200 });
  await assert.rejects(api.healthCheck(), /unexpected response/);
  token = "expired-test-token";
  let requests = 0;
  api.setOnUnauthorized(() => { throw new Error("Should not sign in for a service outage"); });
  globalThis.fetch = async (_url, options) => {
    requests++;
    if (requests === 1) return Response.json({ detail: "expired" }, { status: 401 });
    assert.equal(options.headers.Authorization, undefined);
    return Response.json({ detail: "Service recovering" }, { status: 503 });
  };
  await assert.rejects(api.healthCheck(), /Service recovering/);
  assert.equal(requests, 2);
  globalThis.fetch = async () => new Response(null, { status: 204 });
  await api.removeFromCabinet("test-medicine");
  // An explicit image removal is cancellation, not a provider timeout.
  const removal = new AbortController();
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });
  const scan = api.extractFromImage(new File(["test"], "scan.jpg"), { signal: removal.signal });
  await new Promise(resolve => originalTimer(resolve, 0));
  removal.abort();
  await assert.rejects(scan, error => error.name === "AbortError" && !/took too long/.test(error.message));
  const matchingRemoval = new AbortController();
  const matching = api.matchMedicine("Example", null, null, { signal: matchingRemoval.signal, timeoutMs: 8000 });
  await new Promise(resolve => originalTimer(resolve, 0));
  matchingRemoval.abort();
  await assert.rejects(matching, error => error.name === "AbortError");
  // A stuck Clerk token lookup must not leave scanning active forever or send
  // an image after the user removed it.
  tokenLookup = () => new Promise(() => {});
  const beforeUpload = new AbortController();
  globalThis.fetch = async () => { throw new Error("Cancelled scan must not upload"); };
  const waitingForToken = api.extractFromImage(new File(["test"], "scan.jpg"), { signal: beforeUpload.signal });
  beforeUpload.abort();
  await assert.rejects(waitingForToken, error => error.name === "AbortError");
  globalThis.setTimeout = (fn, _ms) => originalTimer(fn, 1);
  await assert.rejects(api.extractFromImage(new File(["test"], "scan.jpg")), /sign-in service took too long/);
  tokenLookup = async () => token;
  const matchDeadlines = [];
  globalThis.setTimeout = (fn, ms) => { matchDeadlines.push(ms); return originalTimer(fn, 1); };
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
  await assert.rejects(api.matchMedicine("Example", null, null, { timeoutMs: 8000 }), /took too long/);
  assert.ok(matchDeadlines.length >= 2 && matchDeadlines.every(ms => ms <= 8000));
  globalThis.setTimeout = (fn, _ms) => originalTimer(fn, 1);
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
  await assert.rejects(api.healthCheck(), /took too long/);
  globalThis.fetch = async (_url, options) => ({ status: 200, statusText: "OK", headers: new Headers(), arrayBuffer: () => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))) });
  await assert.rejects(api.healthCheck(), /took too long/);
  console.log("PASS: JSON/OCR/voice network errors, timeout, proxy HTML, validation details, retry status and 204 deletion");
} finally {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalTimer;
}
