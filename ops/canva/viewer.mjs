import { createServer } from "node:http";
import { createConnection } from "node:net";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

// Serve noVNC assets without websockify's process-per-HTTP-request overhead.
// Both the viewer and websocket bridge are reachable only through SSH.
const root = "/usr/share/novnc";
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = resolve(root, `.${pathname === "/" ? "/vnc.html" : pathname}`);
    if (!file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!(await stat(file)).isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    const stream = createReadStream(file);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
server.on("upgrade", (req, client, head) => {
  if (
    req.url !== "/websockify" ||
    req.headers.upgrade?.toLowerCase() !== "websocket"
  ) {
    client.destroy();
    return;
  }
  const upstream = createConnection({ host: "127.0.0.1", port: 6083 }, () => {
    const headers = [];
    for (let i = 0; i < req.rawHeaders.length; i += 2)
      headers.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    upstream.write(
      `GET /websockify HTTP/1.1\r\n${headers.join("\r\n")}\r\n\r\n`,
    );
    if (head.length) upstream.write(head);
    client.pipe(upstream).pipe(client);
  });
  client.on("error", () => upstream.destroy());
  client.on("close", () => upstream.destroy());
  upstream.on("error", () => client.destroy());
  upstream.on("close", () => client.destroy());
});
server.listen(6082, "127.0.0.1", () =>
  console.log("Private Canva viewer ready."),
);
