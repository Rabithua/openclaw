import { parseArgs } from "jsr:@std/cli/parse-args";
import { parse as parseYaml } from "jsr:@std/yaml";
import { runOnce } from "./src/core/pipeline.ts";
import type { TravelerConfig } from "./src/core/types.ts";

export { runOnce } from "./src/core/pipeline.ts";
export type { TravelerConfig } from "./src/core/types.ts";
export { handleSubmit, type SubmitRequest, type SubmitResponse } from "./src/handlers/submit.ts";
export { validateApiToken, validateHmacSignature } from "./src/utils/auth.ts";

function usage(): void {
  console.log(
    `Traveler\n\nUsage:\n  deno task run -- <cmd> [--config path]\n\nCommands:\n  run   Fetch sources, select items, and write to Rote\n\nOptions:\n  --config <path>   YAML config (default: configs/default.yaml)\n`,
  );
}

async function loadConfig(path: string): Promise<TravelerConfig> {
  const text = await Deno.readTextFile(path);
  return parseYaml(text) as TravelerConfig;
}

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    boolean: ["help"],
    string: ["config"],
    alias: { h: "help" },
    default: { config: "configs/default.yaml" },
  });

  const cmd = args._[0] ? String(args._[0]) : "";
  if (args.help || !cmd) {
    usage();
    Deno.exit(0);
  }

  if (cmd === "run") {
    const cfg = await loadConfig(String(args.config));
    await runOnce(cfg);
    Deno.exit(0);
  }

  console.error(`Unknown command: ${cmd}`);
  usage();
  Deno.exit(1);
}