/**
 * PATCH  /api/video-scenes/:id
 * DELETE /api/video-scenes/:id
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  visualPrompt: z.string().nullable().optional(),
  durationSec: z.number().int().min(1).max(600).optional(),
  notes: z.string().nullable().optional(),
  sceneOrder: z.number().int().min(0).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("video_projects", "write");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.videoScene.findUnique({ where: { id } });
  if (!existing) return apiError("Adegan tidak dijumpai.", 404);

  const body = await req.json().catch(() => null);
  const parsed = validateBody(updateSchema, body);
  if (parsed instanceof NextResponse) return parsed;

  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.description !== undefined) data.description = parsed.description;
  if (parsed.visualPrompt !== undefined) data.visualPrompt = parsed.visualPrompt;
  if (parsed.durationSec !== undefined) data.durationSec = parsed.durationSec;
  if (parsed.notes !== undefined) data.notes = parsed.notes;
  if (parsed.sceneOrder !== undefined) data.sceneOrder = parsed.sceneOrder;

  const scene = await db.videoScene.update({ where: { id }, data });

  await audit(ctx, "scene.update", "video_scene", id, { changes: data });

  return NextResponse.json({ scene });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("video_projects", "write");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.videoScene.findUnique({ where: { id } });
  if (!existing) return apiError("Adegan tidak dijumpai.", 404);

  await db.videoScene.delete({ where: { id } });

  await audit(ctx, "scene.delete", "video_scene", id, {
    title: existing.title,
    projectId: existing.projectId,
    sceneOrder: existing.sceneOrder,
  });

  return NextResponse.json({ ok: true });
}
