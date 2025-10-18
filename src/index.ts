#!/usr/bin/env bun
import { Command } from "commander";
import { runSetup } from "./commands/setup";
import { runConfig } from "./commands/config";
import { runUpdate } from "./commands/update";
import { runReset } from "./commands/reset";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const program = new Command();
const metaPath = path.join(os.homedir(), ".codr", ".metadata.json");
let metaData = {};

try {
  if (fs.existsSync(metaPath)) {
    metaData = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  }
} catch {
  metaData = {};
}

program
  .name("codr-installer")
  .description("CLI installer for codr")
  .version("1.1.0")
  .option("--setup", "Set up the codr CLI tool")
  .option("--config", "Setup environment variables")
  .option("--update", "Update codr to latest version")
  .option("--reset", "Delete and reset codr installation");

program.parse(process.argv);

const actions = {
  setup: runSetup,
  // @ts-ignore
  config: () => runConfig(metaData.installPath),
  update: runUpdate,
  reset: runReset,
};

for (const [key, action] of Object.entries(actions)) {
  if (program.opts()[key]) {
    await action();
    process.exit(0);
  }
}

program.help();
