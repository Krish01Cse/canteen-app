import { spawn } from "node:child_process";

const processes = [
  spawn("node", ["server.mjs"], { stdio: "inherit", shell: true }),
  spawn("npm", ["run", "dev"], { stdio: "inherit", shell: true }),
];

const shutdown = () => {
  processes.forEach((child) => {
    if (!child.killed) child.kill("SIGTERM");
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

let exited = false;
processes.forEach((child) => {
  child.on("exit", (code) => {
    if (exited) return;
    exited = true;
    shutdown();
    process.exit(code ?? 0);
  });
});
