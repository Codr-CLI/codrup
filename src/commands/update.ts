import { intro, outro, spinner } from "@clack/prompts";
import { execa } from "execa";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import color from "picocolors";

const CODR_ROOT = path.join(os.homedir(), ".codr");
const CLI_PATH = path.join(CODR_ROOT, "apps", "cli-ts");
const RAG_PATH = path.join(CODR_ROOT, "apps", "rag-py");

export async function runUpdate() {
  intro(`${color.bgBlue(color.black(" codr update "))}`);

  if (!fs.existsSync(CODR_ROOT)) {
    outro("❌ codr is not installed. Run `codrup --setup` first.");
    process.exit(1);
  }

  await pullLatestCode();
  await updateNodeDeps();
  await updatePythonDeps();
  await linkGlobally();

  outro(`🎉 ${color.green("codr updated successfully!")}

You can now run:
  ${color.cyan("codr")} — from anywhere ✨
`);
}


async function pullLatestCode() {
    const s = spinner();
    s.start("Syncing codr...");
    try {
      await execa("git", ["pull", "origin", "main"], { cwd: CODR_ROOT });
      s.stop("🔁 Latest version ready.");
    } catch (err) {
      s.stop("❌ Git pull failed.");
      outro(getMsg(err));
      process.exit(1);
    }
  }
  
  async function updateNodeDeps() {
    const s = spinner();
    s.start("Refreshing environment...");
    try {
      await execa("bun", ["install"], { cwd: CLI_PATH });
      await execa("bun", ["run", "build"], { cwd: CLI_PATH });
      s.stop("📦 environment refreshed.");
    } catch (err) {
      s.stop("❌ Node update failed.");
      outro(getMsg(err));
    }
  }
  
  async function updatePythonDeps() {
    const s = spinner();
    s.start("Updating codr Brain...");
    try {
      const venvPath = path.join(RAG_PATH, ".venv");
      const pythonBin =
        os.platform() === "win32"
          ? path.join(venvPath, "Scripts", "python.exe")
          : path.join(venvPath, "bin", "python");
  
      await execa(pythonBin, ["-m", "pip", "install", "-r", "requirements.txt"], {
        cwd: RAG_PATH,
      });
  
      s.stop("🧠 Brain updated.");
    } catch (err) {
      s.stop("❌ Python update failed.");
      outro(getMsg(err));
    }
  }
  
  async function linkGlobally() {
    const s = spinner();
    s.start("Finalizing CLI access...");
    try {
      await execa("bun", ["run", "build"], { cwd: CLI_PATH });
      await execa("npm", ["link"], { cwd: CLI_PATH });
      s.stop("🔗 codr CLI is now available.");
    } catch (err) {
      s.stop("❌ Global linking failed.");
      outro(getMsg(err));
    }
  }
  
  function getMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
  