import assert from "node:assert/strict";
import { resolveRequest } from "./server.js";
assert(resolveRequest("/").endsWith("/index.html"));
assert(resolveRequest("/src/main.js?version=6").endsWith("/src/main.js"));
for (const url of [
  "/../secret",
  "/src/../../secret",
  "/src/%2e%2e/%2e%2e/secret",
  "/src/%00.js",
  "/src/..%5csecret",
  "/package.json",
  "/.git/config",
  "/test.js",
  "/src/.private",
])
  assert.equal(resolveRequest(url), null, url);
assert.throws(() => resolveRequest("/src/%xx"), URIError);
console.log(
  "PASS: Server serves only app assets and rejects traversal, hidden files, and malformed URL escapes.",
);
