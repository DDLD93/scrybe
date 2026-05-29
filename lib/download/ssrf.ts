import { isIP } from "net";

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);

export async function validateDownloadUrl(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are allowed");
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local")) {
    throw new Error("URL host is not allowed");
  }

  if (isPrivateIp(host)) {
    throw new Error("Private IP addresses are not allowed");
  }

  return url.toString();
}

function isPrivateIp(host: string): boolean {
  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const parts = host.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (ipVersion === 6) {
    const h = host.toLowerCase();
    if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) {
      return true;
    }
  }
  return false;
}
