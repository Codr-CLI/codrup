#!/usr/bin/env bun
import { Command } from "commander";
import { runSetup } from "./commands/setup";
import { runConfig } from "./commands/config";
import { runUpdate } from "./commands/update";
import { runReset } from "./commands/reset";

const program = new Command();

program
  .name("codr-installer")
  .description("CLI installer for codr")
  .version("0.1.0")
  .option("--setup", "Set up the codr CLI tool")
  .option("--config", "Setup environment variables")
  .option("--update", "Update codr to latest version")
  .option("--reset", "Delete and reset codr installation");

program.parse(process.argv);

const options = program.opts();

if (options.setup) {
  await runSetup();
} else if (options.config) {
  await runConfig();
} else if (options.update) {
  await runUpdate();
} else if (options.reset) {
  await runReset();
}
