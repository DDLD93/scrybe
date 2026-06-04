import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let materializedPath: string | null = null;

/** Netscape cookies from YTDLP_COOKIES_CONTENT, written once to a temp file inside the container. */
export function materializeYtdlpCookies(content: string | undefined): string | undefined {
  if (!content?.trim()) return undefined;
  if (materializedPath && existsSync(materializedPath)) return materializedPath;

  const dir = join(tmpdir(), "scrybe-ytdlp");
  mkdirSync(dir, { recursive: true });
  materializedPath = join(dir, "cookies.txt");
  writeFileSync(materializedPath, content, "utf8");
  return materializedPath;
}

export function resolveYtdlpCookiesPath(
  filePath: string | undefined,
  content: string | undefined,
): string | undefined {
  if (filePath && existsSync(filePath)) return filePath;
  return materializeYtdlpCookies(content);
}
