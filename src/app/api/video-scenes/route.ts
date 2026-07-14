/**
 * POST /api/video-scenes            — create scene (auto sceneOrder = max+1)
 * POST /api/video-scenes/reorder    — (separate route file, here for reference)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  visualPrompt: z.string().optional(),
  durationSec: z.number().int().min(1).max(600).optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requirePermission("video_projects", "write");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = validateBody(createSchema, body);
  if (parsed instanceof NextResponse) return parsed;

  const project = await db.videoProject.findUnique({ where: { id: parsed.projectId } });
  if (!project) return apiError("Projek video tidak dijumpai.", 404);

  // Auto-increment sceneOrder
  const last = await db.videoScene.findFirst({
    where: { projectId: parsed.projectId },
    orderBy: { sceneOrder: "desc" },
    select: { sceneOrder: true },
  });
  const nextOrder = (last?.sceneOrder ?? 0) + 1;

  const scene = await db.videoScene.create({
    data: {
      projectId: parsed.projectId,
      sceneOrder: nextOrder,
      title: parsed.title,
      description: parsed.description,
      visualPrompt: parsed.visualPrompt ?? null,
      durationSec: parsed.durationSec ?? 10,
      notes: parsed.notes ?? null,
    },
  });

  await audit(ctx, "scene.create", "video_scene", scene.id, {
    projectId: parsed.projectId,
    sceneOrder: nextOrder,
    title: parsed.title,
  });

  return NextResponse.json({ scene }, { status: 201 });
}
