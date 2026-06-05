import { NextRequest } from "next/server";
import { getTranscribeSettings, upsertTranscribeSettings } from "@/lib/db/queries";
import type { LibraryViewMode } from "@/lib/db/schema";
import { toSystemSettings } from "@/lib/transcribe/settings";
import { error, handleRoute, json } from "@/lib/api";
import { authErrorResponse, requireAuth, requirePermission } from "@/lib/auth/require-auth";

function serializeSettings(row: Awaited<ReturnType<typeof getTranscribeSettings>>) {
  const s = toSystemSettings(row);
  return {
    chunkUnit: s.chunkUnit,
    chunkSize: s.chunkSize,
    model: s.audioModel,
    pdfModel: s.pdfModel,
    defaultView: s.defaultView,
    systemPrompt: s.customSystemPrompt,
    lastSystemPromptId: s.lastSystemPromptId,
    lastPdfSystemPromptId: s.lastPdfSystemPromptId,
  };
}

export async function GET(req: Request) {
  return handleRoute(async () => {
    try {
      const user = await requireAuth(req);
      requirePermission(user, "settings:general");
      const settings = await getTranscribeSettings();
      return json({ settings: serializeSettings(settings) });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}

export async function PATCH(req: NextRequest) {
  return handleRoute(async () => {
    try {
      const user = await requireAuth(req);
      requirePermission(user, "settings:general");
      const body = (await req.json()) as Record<string, unknown>;
      const patch: Parameters<typeof upsertTranscribeSettings>[0] = {};

      if ("chunkUnit" in body) {
        const unit = body.chunkUnit;
        if (unit !== "seconds" && unit !== "mb" && unit !== null) {
          return error("chunkUnit must be 'seconds' or 'mb'", 400);
        }
        patch.chunkUnit = unit as string | null;
      }
      if ("chunkSize" in body) {
        const size = body.chunkSize;
        if (size != null && typeof size !== "string" && typeof size !== "number") {
          return error("chunkSize must be a number", 400);
        }
        patch.chunkSize = size != null ? String(size) : null;
      }
      if ("model" in body) patch.model = (body.model as string | null) ?? null;
      if ("pdfModel" in body) patch.pdfModel = (body.pdfModel as string | null) ?? null;
      if ("defaultView" in body) {
        const view = body.defaultView;
        if (view !== "grid" && view !== "list" && view !== null) {
          return error("defaultView must be 'grid' or 'list'", 400);
        }
        patch.defaultView = view as LibraryViewMode | null;
      }
      if ("systemPrompt" in body) patch.systemPrompt = (body.systemPrompt as string | null) ?? null;
      if ("lastSystemPromptId" in body) {
        patch.lastSystemPromptId = (body.lastSystemPromptId as string | null) ?? null;
      }
      if ("lastPdfSystemPromptId" in body) {
        patch.lastPdfSystemPromptId = (body.lastPdfSystemPromptId as string | null) ?? null;
      }

      await upsertTranscribeSettings(patch);
      const settings = await getTranscribeSettings();
      return json({ settings: serializeSettings(settings) });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
