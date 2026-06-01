import { config } from "@/lib/config";

export type DownloadJobOptions = {
  format?: string;
  extractAudio?: boolean;
  audioFormat?: string;
  writeSubs?: boolean;
  subLangs?: string[];
  playlistItems?: string;
  noPlaylist?: boolean;
  outputTemplate?: string;
  cookiesFromBrowser?: string | null;
  proxy?: string | null;
  downloadSections?: string | null;
  sponsorblockRemove?: string[];
  extraArgs?: string[];
};

const PRESETS: Record<string, string[]> = {
  mp3: ["-t", "mp3"],
  aac: ["-t", "aac"],
  mp4: ["-t", "mp4"],
  mkv: ["-t", "mkv"],
  best: ["-f", "bestvideo+bestaudio/best"],
  audio: ["-x", "--audio-format", "mp3"],
};

const ALLOWED_FLAGS = new Set([
  "-f", "--format", "-x", "--extract-audio", "--audio-format", "--audio-quality",
  "--write-subs", "--write-auto-subs", "--sub-langs", "--sub-format",
  "-I", "--playlist-items", "--no-playlist", "-o", "--output",
  "--proxy", "--cookies-from-browser", "--download-sections",
  "--sponsorblock-remove", "--sponsorblock-mark", "--merge-output-format",
  "--ffmpeg-location", "--newline", "--progress-template", "--no-warnings",
  "-t", "--remux-video", "--embed-subs", "--embed-thumbnail",
  "--ignore-errors", "--flat-playlist", "--live-from-start",
  "-r", "--limit-rate", "-N", "--concurrent-fragments",
  "--ignore-config", "--no-update",
  "--extractor-args", "--js-runtimes", "--remote-components", "--cookies",
]);

function appendGlobalYtdlpArgs(argv: string[], options: DownloadJobOptions): void {
  for (const runtime of config.ytdlpJsRuntimes) {
    argv.push("--js-runtimes", runtime);
  }
  argv.push("--remote-components", "ejs:github");
  argv.push("--extractor-args", `youtube:player_client=${config.ytdlpYouTubePlayerClient}`);

  const proxy = options.proxy ?? config.ytdlpProxy;
  if (proxy) argv.push("--proxy", proxy);

  if (config.ytdlpCookiesFile) {
    argv.push("--cookies", config.ytdlpCookiesFile);
  }
}

export function buildYtdlpArgv(
  url: string,
  opts: {
    preset?: string | null;
    options?: DownloadJobOptions;
    outputDir?: string;
    simulate?: boolean;
    listFormats?: boolean;
    dumpJson?: boolean;
    getUrl?: boolean;
    flatPlaylist?: boolean;
    writeSubs?: boolean;
    subLangs?: string;
    subFormat?: string;
    printFilename?: boolean;
  },
): string[] {
  const argv: string[] = [config.ytdlpPath, "--ffmpeg-location", config.ffmpegPath];
  argv.push("--ignore-config", "--no-update");

  if (opts.simulate) argv.push("--simulate", "--no-download");
  if (opts.listFormats) argv.push("-F", "--no-download");
  if (opts.dumpJson) argv.push("--dump-single-json", "--no-download");
  if (opts.getUrl) argv.push("-g", "--no-download");
  if (opts.printFilename) argv.push("--no-download", "--print", "%(title)s.%(ext)s");
  if (opts.flatPlaylist) argv.push("--flat-playlist", "-J");
  if (opts.writeSubs) {
    argv.push("--write-auto-subs", "--skip-download", "--sub-format", opts.subFormat ?? "srt");
    if (opts.subLangs) argv.push("--sub-langs", opts.subLangs);
  }

  const options = opts.options ?? {};
  appendGlobalYtdlpArgs(argv, options);

  if (opts.preset && PRESETS[opts.preset]) {
    argv.push(...PRESETS[opts.preset]);
  }

  if (options.format) argv.push("-f", options.format);
  if (options.extractAudio) argv.push("-x");
  if (options.audioFormat) argv.push("--audio-format", options.audioFormat);
  if (options.writeSubs) argv.push("--write-subs");
  if (options.subLangs?.length) argv.push("--sub-langs", options.subLangs.join(","));
  if (options.playlistItems) argv.push("-I", options.playlistItems);
  if (options.noPlaylist) argv.push("--no-playlist");
  if (options.cookiesFromBrowser) argv.push("--cookies-from-browser", options.cookiesFromBrowser);
  if (options.downloadSections) argv.push("--download-sections", options.downloadSections);
  if (options.sponsorblockRemove?.length) {
    argv.push("--sponsorblock-remove", options.sponsorblockRemove.join(","));
  }

  const outputTemplate = options.outputTemplate ?? "%(title)s.%(ext)s";
  if (
    opts.outputDir &&
    !opts.simulate &&
    !opts.listFormats &&
    !opts.dumpJson &&
    !opts.getUrl &&
    !opts.printFilename
  ) {
    argv.push("-o", `${opts.outputDir}/${outputTemplate}`);
  }

  if (options.extraArgs?.length) {
    for (let i = 0; i < options.extraArgs.length; i++) {
      const arg = options.extraArgs[i];
      if (arg.startsWith("-")) {
        if (!ALLOWED_FLAGS.has(arg.split("=")[0])) {
          throw new Error(`Disallowed flag: ${arg}`);
        }
        argv.push(arg);
      }
    }
  }

  if (
    !opts.simulate &&
    !opts.listFormats &&
    !opts.dumpJson &&
    !opts.getUrl &&
    !opts.writeSubs &&
    !opts.printFilename
  ) {
    argv.push("--newline", "--progress-template", "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s");
  }

  argv.push(url);
  return argv;
}

export function parseFormats(stdout: string) {
  const lines = stdout.split("\n");
  const formats: Array<Record<string, string>> = [];
  let headers: string[] = [];
  for (const line of lines) {
    if (line.includes("ID ") && line.includes("EXT")) {
      headers = line.trim().split(/\s{2,}/);
      continue;
    }
    if (!line.trim() || line.startsWith("[") || headers.length === 0) continue;
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 2) {
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h.toLowerCase().replace(/\s+/g, "_")] = parts[i] ?? "";
      });
      row.id = parts[0];
      formats.push(row);
    }
  }
  return formats;
}
