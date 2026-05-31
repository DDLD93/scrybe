/** Hausa phonetic key swaps for edit mode (V/P/Q/X → implosive letters). */
export const HAUSA_ORTHOGRAPHY_KEY_MAP: Record<string, string> = {
  v: "ɓ",
  V: "Ɓ",
  p: "ɗ",
  P: "Ɗ",
  q: "ƙ",
  Q: "Ƙ",
  x: "ʼy",
  X: "ʼY",
};

export function applyHausaOrthographyKey(
  key: string,
  value: string,
  selectionStart: number,
  selectionEnd: number,
): { value: string; cursor: number } | null {
  const symbol = HAUSA_ORTHOGRAPHY_KEY_MAP[key];
  if (!symbol) return null;

  const next =
    value.slice(0, selectionStart) + symbol + value.slice(selectionEnd);
  return { value: next, cursor: selectionStart + symbol.length };
}
