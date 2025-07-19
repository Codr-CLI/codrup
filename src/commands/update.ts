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


  // --- Step 2: Run update steps ---
  await pullLatestCode(meta.installPath);
  await updateNodeDeps(meta.installPath);
  await updatePythonDeps(meta.installPath);
  await linkGlobally(meta.installPath);

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


export async function updatePythonDeps(installPath: string) {
  const ragPath = path.join(installPath, ".");
  const venvPath = path.join(ragPath, ".venv");

  const s = spinner();
  s.start("⚙️  Finalizing Python environment...");

  try {
    await execa("uv", ["venv", venvPath], {
      cwd: ragPath,
      stdio: "inherit",
    });

    await execa("uv", ["pip", "install", "-r", "requirements.txt", "--python", path.join(venvPath, "./")], {
      cwd: ragPath,
    });

    s.stop(`✅ ${color.green("AI backend ready.")}`);
  } catch (err) {
    s.stop("❌ Python environment setup failed.");
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
