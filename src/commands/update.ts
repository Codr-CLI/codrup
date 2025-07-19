import { intro, outro, spinner } from "@clack/prompts";
import { execa } from "execa";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import color from "picocolors";

const CODR_ROOT = path.join(os.homedir(), ".codr");
const META_PATH = path.join(CODR_ROOT, "meta.json");

export async function runUpdate() {
  intro(`${color.bgBlue(color.black(" codr update "))}`);

  // --- Step 1: Validate Install ---
  if (!fs.existsSync(CODR_ROOT)) {
    outro("❌ codr is not installed. Run `codrup --setup` first.");
    process.exit(1);
  }

  const meta = readMetaFile();

  const CLI_PATH = path.join(meta.installPath, "apps", "cli-ts");
  const RAG_PATH = path.join(meta.installPath, "apps", "rag-py");

  // --- Step 2: Run update steps ---
  await pullLatestCode(meta.installPath);
  await updateNodeDeps(CLI_PATH);
  await updatePythonDeps(RAG_PATH, meta.pythonVenvPath);
  await linkGlobally(CLI_PATH);

  updateLastUpdated();

  outro(`🎉 ${color.green("codr updated successfully!")}

You can now run:
  ${color.cyan("codr")} — from anywhere ✨
`);
}

function readMetaFile(): any {
  try {
    if (!fs.existsSync(META_PATH)) {
      throw new Error("Missing meta.json file");
    }
    const raw = fs.readFileSync(META_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    outro("❌ Failed to read installation metadata.");
    console.error(getMsg(err));
    process.exit(1);
  }
}

function updateLastUpdated() {
  try {
    const meta = readMetaFile();
    meta.lastUpdated = new Date().toISOString();
    fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  } catch (err) {
    console.warn("⚠️ Failed to update lastUpdated in meta.json");
  }
}

async function pullLatestCode(codrPath: string) {
  const s = spinner();
  s.start("Syncing codr...");
  try {
    await execa("git", ["pull", "origin", "main"], { cwd: codrPath });
    s.stop("🔁 Latest version ready.");
  } catch (err) {
    s.stop("❌ Git pull failed.");
    outro(getMsg(err));
    process.exit(1);
  }
}

async function updateNodeDeps(cliPath: string) {
  const s = spinner();
  s.start("Refreshing environment...");
  try {
    await execa("bun", ["install"], { cwd: cliPath });
    await execa("bun", ["run", "build"], { cwd: cliPath });
    s.stop("📦 Environment refreshed.");
  } catch (err) {
    s.stop("❌ Node update failed.");
    outro(getMsg(err));
  }
}

async function updatePythonDeps(ragPath: string, venvPath: string) {
  const s = spinner();
  s.start("Updating codr Brain...");
  try {
    const pythonBin =
      os.platform() === "win32"
        ? path.join(venvPath, "Scripts", "python.exe")
        : path.join(venvPath, "bin", "python");

    await execa(pythonBin, ["-m", "pip", "install", "-r", "requirements.txt"], {
      cwd: ragPath,
    });

    s.stop("🧠 Brain updated.");
  } catch (err) {
    s.stop("❌ Python update failed.");
    outro(getMsg(err));
  }
}

async function linkGlobally(cliPath: string) {
  const s = spinner();
  s.start("Finalizing CLI access...");
  try {
    await execa("bun", ["run", "build"], { cwd: cliPath });
    await execa("npm", ["link"], { cwd: cliPath });
    s.stop("🔗 codr CLI is now available.");
  } catch (err) {
    s.stop("❌ Global linking failed.");
    outro(getMsg(err));
  }
}

function getMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
