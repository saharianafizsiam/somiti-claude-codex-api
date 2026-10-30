import http from "node:http";
import net from "node:net";

const proxies = [
  { host: "45.38.107.97", port: 6014, user: "kdohjqzb", pass: "8jfy34esix4h" },
  { host: "64.137.96.74", port: 6641, user: "kdohjqzb", pass: "8jfy34esix4h" },
  { host: "198.23.243.226", port: 6361, user: "kdohjqzb", pass: "8jfy34esix4h" },
  { host: "38.154.185.97", port: 6370, user: "kdohjqzb", pass: "8jfy34esix4h" },
  { host: "84.247.60.125", port: 6095, user: "kdohjqzb", pass: "8jfy34esix4h" },
  { host: "191.96.254.138", port: 6185, user: "kdohjqzb", pass: "8jfy34esix4h" },
  { host: "198.46.161.42", port: 5092, user: "kdohjqzb", pass: "8jfy34esix4h" },
  { host: "64.137.10.153", port: 5803, user: "kdohjqzb", pass: "8jfy34esix4h" },
  { host: "104.164.49.38", port: 7693, user: "kdohjqzb", pass: "8jfy34esix4h" },
  { host: "23.26.71.145", port: 5628, user: "kdohjqzb", pass: "8jfy34esix4h" },
].map((p) => ({
  ...p,
  auth: Buffer.from(`${p.user}:${p.pass}`).toString("base64"),
}));

let currentIndex = 0;
const activeSockets = new Set();

function currentProxy() {
  return proxies[currentIndex];
}

export function rotateProxy() {
  currentIndex = (currentIndex + 1) % proxies.length;
  const p = proxies[currentIndex];
  console.log(`[Proxy Rotator] Switched to #${currentIndex + 1}: ${p.host}:${p.port}`);
  for (const socket of activeSockets) {
    try {
      socket.destroy();
    } catch {}
  }
  activeSockets.clear();
  return { index: currentIndex, host: p.host, port: p.port };
}

const server = http.createServer((req, res) => {
  if (req.url === "/_rotate") {
    const next = rotateProxy();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(next));
    return;
  }
  if (req.url === "/_current") {
    const curr = currentProxy();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ index: currentIndex, host: curr.host, port: curr.port }));
    return;
  }

  // Plain HTTP proxying
  const p = currentProxy();
  const options = {
    hostname: p.host,
    port: p.port,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      "Proxy-Authorization": `Basic ${p.auth}`,
    },
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", () => {
    res.writeHead(502);
    res.end("Bad gateway");
  });
  req.pipe(proxyReq);
});

// HTTPS tunneling (CONNECT method)
server.on("connect", (req, clientSocket, head) => {
  const p = currentProxy();
  const upstream = net.connect(p.port, p.host, () => {
    upstream.write(
      `CONNECT ${req.url} HTTP/1.1\r\n` +
      `Host: ${req.url}\r\n` +
      `Proxy-Authorization: Basic ${p.auth}\r\n` +
      `Proxy-Connection: Keep-Alive\r\n\r\n`,
    );
    if (head && head.length) upstream.write(head);
  });

  let established = false;
  let buffer = "";

  upstream.on("data", (chunk) => {
    if (!established) {
      buffer += chunk.toString("binary");
      const idx = buffer.indexOf("\r\n\r\n");
      if (idx !== -1) {
        established = true;
        const statusLine = buffer.slice(0, buffer.indexOf("\r\n"));
        if (statusLine.includes(" 200 ")) {
          clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          const remaining = buffer.slice(idx + 4);
          if (remaining.length > 0) {
            clientSocket.write(Buffer.from(remaining, "binary"));
          }
          clientSocket.pipe(upstream);
          upstream.pipe(clientSocket);
        } else {
          clientSocket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
          clientSocket.end();
          upstream.end();
        }
      }
    }
  });

  upstream.on("error", () => {
    clientSocket.destroy();
  });
  clientSocket.on("error", () => {
    upstream.destroy();
  });
});

server.on("connection", (socket) => {
  activeSockets.add(socket);
  socket.on("close", () => activeSockets.delete(socket));
});

server.listen(8888, "127.0.0.1", () => {
  const p = proxies[0];
  console.log(`[Proxy Rotator] Ready on 127.0.0.1:8888. Active: ${p.host}:${p.port}`);
});
