const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const dist = path.join(root, "dist");

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDir(sourcePath, targetPath);
    if (entry.isFile()) copyFile(sourcePath, targetPath);
  }
}

fs.rmSync(dist, { recursive: true, force: true });
copyFile(path.join(root, "index.html"), path.join(dist, "index.html"));
copyFile(path.join(root, "styles.css"), path.join(dist, "styles.css"));
copyFile(path.join(root, ".openai", "hosting.json"), path.join(dist, ".openai", "hosting.json"));
copyDir(path.join(root, "src"), path.join(dist, "src"));
fs.mkdirSync(path.join(dist, "server"), { recursive: true });
fs.writeFileSync(
  path.join(dist, "server", "index.js"),
  `const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const publicDir = path.resolve(__dirname, "..");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function resolvePath(url) {
  const requestPath = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const filePath = path.normalize(path.join(publicDir, requestPath === "/" ? "index.html" : requestPath));
  if (!filePath.startsWith(publicDir)) return null;
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : path.join(publicDir, "index.html");
}

const server = http.createServer((req, res) => {
  const filePath = resolvePath(req.url);
  if (!filePath) return send(res, 403, "Forbidden");
  fs.readFile(filePath, (error, data) => {
    if (error) return send(res, 500, "Server error");
    send(res, 200, data, mime[path.extname(filePath)] || "application/octet-stream");
  });
});

const port = process.env.PORT || 3000;
server.listen(port, "0.0.0.0", () => {
  console.log("Sales F2 Monitoring running on " + port);
});
`
);
