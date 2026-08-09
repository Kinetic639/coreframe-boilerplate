import { spawn } from "node:child_process";
import process from "node:process";

const port = Number(process.env.PORT ?? 3001);
const host = "127.0.0.1";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://${host}:${port}`;
const extraArgs = process.argv.slice(2);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      shell: false,
      ...options
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? signal}`));
    });
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.status < 500) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (child.exitCode === null && child.signalCode === null && process.platform === "win32") {
    await new Promise((resolve) => {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        shell: false
      }).on("exit", resolve);
    });
  }
}

const nextBin = "./node_modules/next/dist/bin/next";
const playwrightCli = "./node_modules/@playwright/test/cli.js";

let server;

try {
  await run(process.execPath, [nextBin, "build"]);

  server = spawn(process.execPath, [
    "--use-system-ca",
    nextBin,
    "start",
    "-p",
    String(port),
    "--hostname",
    host
  ], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "inherit", "inherit"],
    shell: false
  });

  await waitForServer(baseUrl);
  await run(process.execPath, [playwrightCli, "test", ...extraArgs], {
    env: { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl }
  });
} finally {
  if (server) await stopServer(server);
}
