import { accessSync, constants, existsSync } from "fs";
import { execFileSync } from "child_process";

/** Resolve a configured tool name to an absolute path. */
export function resolveToolPath(configured: string): string {
  if (existsSync(configured)) {
    try {
      accessSync(configured, constants.X_OK);
    } catch {
      /* exists but may not be executable on Windows */
    }
    return configured;
  }

  try {
    if (process.platform === "win32") {
      const out = execFileSync("where", [configured], { encoding: "utf8" }).trim();
      const first = out.split(/\r?\n/)[0]?.trim();
      if (first) return first;
    } else {
      const out = execFileSync("sh", ["-c", `command -v ${JSON.stringify(configured)}`], {
        encoding: "utf8",
      }).trim();
      if (out) return out;
    }
  } catch {
    /* fall through */
  }

  return configured;
}
