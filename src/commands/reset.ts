import { intro, confirm, spinner, outro } from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import color from "picocolors";
import { runSetup } from "./setup";

const DEFAULT_ROOT = path.join(os.homedir(), ".codr");
const META_PATH = path.join(DEFAULT_ROOT, "meta.json");

export async function runReset() {
  intro(`${color.bgRed(color.white(" codr reset "))}`);

  if (!fs.existsSync(META_PATH)) {
    outro("⚠️ codr is not installed or metadata is missing.");
    process.exit(0);
  }

  const meta = readMeta();

  const confirmWipe = await confirm({
    message: `This will permanently delete codr at:\n  ${color.yellow(meta.installPath)}\nContinue?`,
    initialValue: false,
  });

  if (!confirmWipe) {
    outro("❌ Reset cancelled.");
    process.exit(0);
  }

  const s = spinner();
  s.start(`Deleting ${meta.installPath}...`);

  try {
    fs.rmSync(meta.installPath, { recursive: true, force: true });
    s.stop("✅ codr installation deleted.");
  } catch (err) {
    s.stop("❌ Failed to delete codr.");
    outro(getMsg(err));
    process.exit(1);
  }

  const reinstall = await confirm({
    message: "Do you want to re-install codr now?",
    initialValue: true,
  });

  if (reinstall) {
    await runSetup();
  } else {
    outro("🧹 codr has been reset. You can re-install later using:");
    console.log(color.cyan("codrup --setup"));
  }
}

function readMeta(): any {
  try {
    const raw = fs.readFileSync(META_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    outro("❌ Failed to read metadata file.");
    console.error(getMsg(err));
    process.exit(1);
  }
}

function getMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
