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
copyDir(path.join(root, "data"), path.join(dist, "data"));
copyDir(path.join(root, "src"), path.join(dist, "src"));
fs.mkdirSync(path.join(dist, "server"), { recursive: true });
const assets = {
  "/": {
    body: fs.readFileSync(path.join(root, "index.html"), "utf8"),
    type: "text/html; charset=utf-8",
  },
  "/index.html": {
    body: fs.readFileSync(path.join(root, "index.html"), "utf8"),
    type: "text/html; charset=utf-8",
  },
  "/styles.css": {
    body: fs.readFileSync(path.join(root, "styles.css"), "utf8"),
    type: "text/css; charset=utf-8",
  },
  "/src/app.js": {
    body: fs.readFileSync(path.join(root, "src", "app.js"), "utf8"),
    type: "application/javascript; charset=utf-8",
  },
  "/data/sales-data.js": {
    body: fs.readFileSync(path.join(root, "data", "sales-data.js"), "utf8"),
    type: "application/javascript; charset=utf-8",
  },
};
fs.writeFileSync(
  path.join(dist, "server", "index.js"),
  `const assets = ${JSON.stringify(assets)};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const asset = assets[url.pathname] || assets["/index.html"];
    return new Response(asset.body, {
      headers: {
        "Content-Type": asset.type,
        "Cache-Control": url.pathname === "/" || url.pathname === "/index.html" ? "no-store" : "public, max-age=3600"
      }
    });
  }
};
`
);
