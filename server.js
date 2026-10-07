import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};
export function resolveRequest(url) {
  const requested = decodeURIComponent(url.split("?")[0]);
  if (requested.includes("\0") || requested.includes("\\")) return null;
  const relative =
    requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
  // Serve application assets only; never expose source backups, test files or dotfiles.
  if (!["index.html"].includes(relative) && !relative.startsWith("src/"))
    return null;
  const target = path.resolve(root, relative);
  if (
    !target.startsWith(root + path.sep) ||
    relative.split("/").some((part) => part === ".." || part.startsWith("."))
  )
    return null;
  return target;
}
const server = http.createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    const file = resolveRequest(req.url);
    if (!file) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const content = await fs.readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http: https:; media-src 'self' blob: http: https:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (error) {
    res.writeHead(
      error instanceof URIError
        ? 400
        : error.code === "ENOENT" || error.code === "EISDIR"
          ? 404
          : 500,
    );
    res.end("Unable to serve this file.");
  }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.on("error", (error) => {
    console.error(
      error.code === "EADDRINUSE"
        ? `Port ${port} is already in use. Close the other Coffee server or set PORT to a different number.`
        : error.message,
    );
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () =>
    console.log(`\n☕ Coffee is running at: http://localhost:${port}/\n`),
  );
}
