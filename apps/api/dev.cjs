const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const agno = path.join(root, "agno-v2");
const children = [];
let stopping = false;

const database = spawnSync("docker", ["compose", "up", "-d", "--wait", "database"], {
  cwd: root,
  stdio: "inherit",
});
if (database.error || database.status !== 0) {
  console.error("Database lokal gagal dijalankan. Pastikan Docker Desktop aktif.");
  process.exit(database.status || 1);
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  setTimeout(() => process.exit(code), 250);
}

const conversation = spawn("uv", ["run", "--project", agno, "--locked", "uvicorn", "app.main:app", "--app-dir", agno, "--host", "127.0.0.1", "--port", "8010", "--no-access-log"], {
  cwd: root,
  stdio: "inherit",
});
children.push(conversation);

const api = spawn(process.execPath, ["--watch", path.join(__dirname, "dist", "main.js")], {
  cwd: root,
  stdio: "inherit",
});
children.push(api);

conversation.on("error", error => {
  console.error(`Agno gagal dijalankan: ${error.message}`);
  stop(1);
});
conversation.on("exit", code => {
  if (!stopping && code !== 0) stop(code ?? 1);
});
api.on("error", error => {
  console.error(`API gagal dijalankan: ${error.message}`);
  stop(1);
});
api.on("exit", code => stop(code ?? 1));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
