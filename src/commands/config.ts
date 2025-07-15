import {
    intro,
    outro,
    select,
    text,
    isCancel,
  } from "@clack/prompts";
  import fs from "node:fs";
  import path from "node:path";
  import color from "picocolors";
  
  const ENV_PATH = path.join("apps", "cli-ts", ".env");
  
  const PROVIDERS = {
    gemini: {
      name: "Gemini",
      keyName: "GEMINI_API_KEY",
      models: [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
      ],
    },
    claude: {
      name: "Claude",
      keyName: "CLAUDE_API_KEY",
      models: [
        "claude-3-opus",
        "claude-3-sonnet",
        "claude-3.5-sonnet-v2",
        "claude-3.7-sonnet",
        "claude-4-sonnet-4",
        "claude-4-opus-4",
      ],
    },
    deepseek: {
      name: "DeepSeek",
      keyName: "DEEPSEEK_API_KEY",
      models: ["deepseek-chat", "deepseek-coder"],
    },
    openai: {
      name: "OpenAI",
      keyName: "OPENAI_API_KEY",
      models: [
        "gpt-4o",
        "gpt-4",
        "gpt-3.5-turbo",
        "gpt-4.1",
        "gpt-4.1-mini",
        "gpt-4.1-nano",
      ],
    },
  } as const;
  
  export async function runConfig() {
    intro(`${color.bgMagenta(color.black(" codr config "))}`);
  
    let llm: keyof typeof PROVIDERS;
    let model: string;
    let llmKey: string;
    let openRouterKey: string | null = null;
  
    // --- Step 1: Select LLM Provider ---
    try {
      const res = await select({
        message: "Select your LLM provider:",
        options: Object.entries(PROVIDERS).map(([value, { name }]) => ({
          value,
          label: name,
        })),
      });
  
      if (isCancel(res)) throw new Error("User cancelled selection.");
  
      llm = res;
    } catch (err) {
      outro(`❌ Error choosing provider: ${color.red(getMsg(err))}`);
      process.exit(1);
    }
  
    // --- Step 2: Select model ---
    try {
      const res = await select({
        message: `Choose a model from ${PROVIDERS[llm].name}:`,
        options: PROVIDERS[llm].models.map((m) => ({ value: m, label: m })),
      });
  
      if (isCancel(res)) throw new Error("User cancelled model selection.");
      model = res;
    } catch (err) {
      outro(`❌ Error choosing model: ${color.red(getMsg(err))}`);
      process.exit(1);
    }
  
    // --- Step 3: Ask for LLM key ---
    try {
      const res = await text({
        message: `Enter your ${PROVIDERS[llm].name} API key:`,
        placeholder: "sk-abc123...",
        validate: (v) => (v.trim().length < 5 ? "Key too short" : undefined),
      });
  
      if (isCancel(res)) throw new Error("User cancelled key input.");
      llmKey = res.trim();
    } catch (err) {
      outro(`❌ Error collecting API key: ${color.red(getMsg(err))}`);
      process.exit(1);
    }
  
    // --- Step 4: Ask for OpenRouter key (optional) ---
    try {
      const res = await text({
        message: `Enter your OpenRouter API key (Required):`,
        placeholder: "sk-openrouter...",
        validate: (v) => (v.trim().length < 5 ? "Key too short" : undefined),
      });
  
      if (!isCancel(res) && res.trim()) {
        openRouterKey = res.trim();
      }
    } catch (err) {
      outro(`⚠️ Failed to read OpenRouter key: ${color.yellow(getMsg(err))}`);
    }
  
    // --- Step 5: Generate .env content ---
    const envLines = [
      `SELECTED_LLM=${llm}`,
      `${PROVIDERS[llm].keyName}=${llmKey}`,
    ];
  
    if (openRouterKey) {
      envLines.push(`OPEN_ROUTER_API_KEY=${openRouterKey}`);
    }
  
    try {
      const envDir = path.dirname(ENV_PATH);
      if (!fs.existsSync(envDir)) {
        fs.mkdirSync(envDir, { recursive: true });
      }
  
      fs.writeFileSync(ENV_PATH, envLines.join("\n") + "\n", "utf-8");
      outro(`✅ ${color.green(".env file created successfully at")} ${ENV_PATH}`);
    } catch (err) {
      outro(`❌ Failed to write .env file: ${color.red(getMsg(err))}`);
      process.exit(1);
    }
  }
  
  // Helper to extract message safely
  function getMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
  