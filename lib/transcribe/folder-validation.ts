const FOLDER_NAME_MAX = 100;

export function normalizeFolderName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > FOLDER_NAME_MAX) return null;
  return trimmed;
}

export function normalizeFilename(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 255) return null;
  return trimmed;
}
