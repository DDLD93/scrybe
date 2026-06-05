function env(key: string, fallback: string): string {
  const value = process.env[key];
  if (value !== undefined && value !== "") return value;
  return fallback;
}

const DEFAULT_NAME = "Scrybe";
const DEFAULT_PRIMARY_COLOR = "oklch(0.518 0.253 323.949)";
const DEFAULT_PRIMARY_COLOR_DARK_MODE = "oklch(0.78 0.14 220)";

export type Branding = {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  primaryColorDarkMode: string;
  tagline: string;
};

export const branding: Branding = {
  name: env("NAME", DEFAULT_NAME),
  logoUrl: env("LOGO_URL", "") || null,
  primaryColor: env("PRIMARY_COLOR", DEFAULT_PRIMARY_COLOR),
  primaryColorDarkMode: env("PRIMARY_COLOR_DARK_MODE", DEFAULT_PRIMARY_COLOR_DARK_MODE),
  tagline: "Process audio, PDF, and media into editable text",
};

export function getBrandingStyles(): string {
  const { primaryColor, primaryColorDarkMode } = branding;

  return `
:root {
  --primary: ${primaryColor};
  --accent: ${primaryColor};
  --sidebar-primary: ${primaryColor};
  --ring: color-mix(in srgb, ${primaryColor} 50%, transparent);
}
.dark {
  --primary: ${primaryColorDarkMode};
  --accent: ${primaryColorDarkMode};
  --sidebar-primary: ${primaryColorDarkMode};
  --ring: color-mix(in srgb, ${primaryColorDarkMode} 50%, transparent);
}
`.trim();
}
