/* Servidor de desarrollo local para RUNBOUND. Solo lectura.
   El puerto lo asigna el harness por PORT; 8500 es el default a mano. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const PORT = process.env.PORT || 8500;

const types = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css",
  ".json":"application/json", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg",
  ".svg":"image/svg+xml", ".webp":"image/webp", ".webmanifest":"application/manifest+json" };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(root, p);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream",
                         "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(PORT, () => console.log("runbound on http://localhost:" + PORT));
