import { intro, outro, spinner, confirm, text } from "@clack/prompts";
import color from "picocolors";
import { execa } from "execa";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { checkDependencies } from "../utils/checkSystem";
import { runConfig } from "./config";
import { welcomeScreen } from "../utils/welcomeScreen";

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
  const configInfo = await configureEnv(installPath);
  await linkGlobally(installPath);

  writeMetaFile(DEFAULT_INSTALL_PATH, configInfo);

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

export async function setupPythonEnv(installPath: string) {
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

async function configureEnv(installPath: string) {
  try {
    const config = await runConfig(installPath);
    return config;
  } catch (err) {
    outro("⚠️ Skipping config setup due to error:");
    console.error(getMsg(err));
    return null;
  }
}

async function linkGlobally(installPath: string) {
  const cliPath = path.join(installPath, "apps", "cli-ts");
  const s = spinner();
  s.start("Making codr available globally...");
  try {
    await execa("bun", ["run", "build"], { cwd: cliPath });
    await execa("npm", ["link"], { cwd: cliPath });
    s.stop("🔗 codr installed.");
    welcomeScreen()
  } catch (err) {
    s.stop("❌ Global linking failed.");
    outro(getMsg(err));
  }
}

function getMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function getCurrentVersion(installPath: string): string {
  try {
    const pkgJson = fs.readFileSync(path.join(installPath, "apps", "cli-ts", "package.json"), "utf-8");
    return JSON.parse(pkgJson).version ?? "unknown";
  } catch {
    return "unknown";
  }
}


function writeMetaFile(installPath: string, config?: any) {
  const meta = {
    installPath,
    pythonVenvPath: path.join(installPath, ".venv"),
    installDate: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    platform: process.platform,
    version: getCurrentVersion(installPath),
    userConfig: config || {}
  };

  const metaPath = path.join(installPath, "meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}