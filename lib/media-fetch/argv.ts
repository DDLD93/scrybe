import { config } from "@/lib/config";

const PRESETS: Record<string, string[]> = {
  mp3: ["-t", "mp3"],
  aac: ["-t", "aac"],
  best: ["-f", "bestvideo+bestaudio/best"],
};

function appendGlobalYtdlpArgs(argv: string[]): void {
  for (const runtime of config.ytdlpJsRuntimes) {
    argv.push("--js-runtimes", runtime);
  }
  argv.push("--remote-components", "ejs:github");
  argv.push("--extractor-args", `youtube:player_client=${config.ytdlpYouTubePlayerClient}`);

  if (config.ytdlpProxy) argv.push("--proxy", config.ytdlpProxy);

  if (config.ytdlpCookiesFile) {
    argv.push("--cookies", config.ytdlpCookiesFile);
  }
}

/** Build yt-dlp argv for downloading media into outputDir. */
export function buildFetchArgv(
  url: string,
  opts: { preset?: string | null; outputDir: string },
): string[] {
  const argv: string[] = [config.ytdlpPath, "--ffmpeg-location", config.ffmpegPath];
  argv.push("--ignore-config", "--no-update");
  appendGlobalYtdlpArgs(argv);

  const preset = opts.preset ?? "mp3";
  if (PRESETS[preset]) {
    argv.push(...PRESETS[preset]);
  } else {
    argv.push(...PRESETS.mp3);
  }

  argv.push("-o", `${opts.outputDir}/%(title)s.%(ext)s`);
  argv.push(
    "--newline",
    "--progress-template",
    "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
  );
  argv.push(url);
  return argv;
}
