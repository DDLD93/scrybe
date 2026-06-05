import { randomUUID } from "crypto";
import { countSystemPrompts, createSystemPrompt } from "@/lib/db/queries-system-prompts";

const SEEDS = [
  {
    name: "Verbatim transcript",
    fileTypes: ["audio"] as const,
    prompt:
      "Transcribe speech verbatim. Preserve filler words, pauses as ellipses, and speaker intent. Use standard punctuation.",
  },
  {
    name: "Plain text OCR",
    fileTypes: ["pdf"] as const,
    prompt:
      "Extract all visible text from this page exactly as written. Preserve paragraph breaks. Output plain text only.",
  },
  {
    name: "Structured minutes",
    fileTypes: ["pdf"] as const,
    prompt:
      "Extract text from this page and format as concise meeting minutes with headings and bullet points where appropriate.",
  },
];

async function main() {
  const existing = await countSystemPrompts();
  if (existing > 0) {
    console.log(`system_prompts already has ${existing} row(s); skipping seed.`);
    return;
  }
  for (const seed of SEEDS) {
    await createSystemPrompt({
      id: randomUUID(),
      name: seed.name,
      fileTypes: [...seed.fileTypes],
      prompt: seed.prompt,
    });
    console.log(`Created: ${seed.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
