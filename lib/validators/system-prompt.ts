import { z } from "zod";

export const fileTypeSchema = z.enum(["audio", "pdf"]);

export const systemPromptCreateSchema = z.object({
  name: z.string().min(1).max(100),
  fileTypes: z.array(fileTypeSchema).min(1),
  prompt: z.string().min(1).max(10000),
});

export const systemPromptUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  fileTypes: z.array(fileTypeSchema).min(1).optional(),
  prompt: z.string().min(1).max(10000).optional(),
});
