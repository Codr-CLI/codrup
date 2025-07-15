import { intro, outro, spinner, confirm, text } from "@clack/prompts";
import color from "picocolors";
import { execa } from "execa";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { checkDependencies } from "../utils/checkSystem";
import { runConfig } from "./config";

const DEFAULT_INSTALL_PATH = path.join(os.homedir(), ".codr");
const GIT_REPO = "https://github.com/pshycodr/codr";

export async function runSetup() {
  intro(`${color.bgCyan(color.black(" codr setup "))}`);

  const ok = await checkDependencies(["git", "bun", "uv", "python3"]);
  if (!ok) {
    outro("❌ Setup aborted due to missing dependencies.");
    process.exit(1);
  }

  const installPath = await promptInstallPath();
  await cloneRepo(installPath);
  await installNodeDeps(installPath);
  await setupPythonEnv(installPath);
  await configureEnv();
  await linkGlobally(installPath);

  outro(`🎉 ${color.green("codr is ready!")}

You can now run:
  ${color.cyan("codr")}

Anywhere in your terminal ✨`);
}


async function promptInstallPath(): Promise<string> {
  const targetPath = await text({
    message: "Where should codr be installed?",
    placeholder: DEFAULT_INSTALL_PATH,
    initialValue: DEFAULT_INSTALL_PATH,
  });

  if (!targetPath) {
    outro("❌ Setup cancelled.");
    process.exit(0);
  }

  const exists = fs.existsSync(targetPath);
  if (exists) {
    const overwrite = await confirm({
      message: "Directory already exists. Overwrite?",
      initialValue: false,
    });
    if (!overwrite) {
      outro("❌ Setup cancelled.");
      process.exit(0);
    }
    fs.rmSync(targetPath, { recursive: true, force: true });
  }

  return targetPath;
}

async function cloneRepo(targetPath: string) {
  const s = spinner();
  s.start("Preparing workspace...");
  try {
    await execa("git", ["clone", GIT_REPO, targetPath]);
    s.stop("🧱 Workspace ready.");
  } catch (err) {
    s.stop("❌ Failed to prepare workspace.");
    outro(getMsg(err));
    process.exit(1);
  }
}

async function installNodeDeps(installPath: string) {
  const cliPath = path.join(installPath, "apps", "cli-ts");
  const s = spinner();
  s.start("Setting up system...");
  try {
    await execa("bun", ["install"], { cwd: cliPath });
    s.stop("📦 Environment prepared.");
  } catch (err) {
    s.stop("❌ Node setup failed.");
    outro(getMsg(err));
  }
}

async function setupPythonEnv(installPath: string) {
  const ragPath = path.join(installPath, "apps", "rag-py");
  const venvPath = path.join(ragPath, ".venv");
  const s = spinner();
  s.start("Finalizing system...");
  try {
    await execa("uv", ["venv", ".venv"], { cwd: ragPath });

    const pythonBin =
      os.platform() === "win32"
        ? path.join(venvPath, "Scripts", "python.exe")
        : path.join(venvPath, "bin", "python");

    await execa(pythonBin, ["-m", "pip", "install", "-r", "requirements.txt"], {
      cwd: ragPath,
    });

    s.stop("🧠 AI backend ready.");
  } catch (err) {
    s.stop("❌ Python environment setup failed.");
    outro(getMsg(err));
  }
}

async function configureEnv() {
  try {
    await runConfig();
  } catch (err) {
    outro("⚠️ Skipping config setup due to error:");
    console.error(getMsg(err));
  }
}

async function linkGlobally(installPath: string) {
  const cliPath = path.join(installPath, "apps", "cli-ts");
  const s = spinner();
  s.start("Making codr available globally...");
  try {
    await execa("bun", ["link"], { cwd: cliPath });
    s.stop("🔗 codr installed.");
  } catch (err) {
    s.stop("❌ Global linking failed.");
    outro(getMsg(err));
  }
}

function getMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
