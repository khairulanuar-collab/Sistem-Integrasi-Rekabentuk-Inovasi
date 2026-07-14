/**
 * POST /api/video-scenes/reorder
 * Body: { items: Array<{ id: string, sceneOrder: number }> }
 * Updates all sceneOrder in a transaction.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

const schema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        sceneOrder: z.number().int().min(0),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  const ctx = await requirePermission("video_projects", "write");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = validateBody(schema, body);
  if (parsed instanceof NextResponse) return parsed;

  // Verify all scenes exist
  const ids = parsed.items.map((i) => i.id);
  const found = await db.videoScene.findMany({
    where: { id: { in: ids } },
    select: { id: true, projectId: true },
  });
  if (found.length !== ids.length) {
    return apiError("Sesetengah adegan tidak dijumpai.", 404);
  }

  await db.$transaction(
    parsed.items.map((item) =>
      db.videoScene.update({
        where: { id: item.id },
        data: { sceneOrder: item.sceneOrder },
      })
    )
  );

  const projectId = found[0]?.projectId;
  await audit(ctx, "scene.reorder", "video_project", projectId ?? null, {
    count: parsed.items.length,
    items: parsed.items,
  });

  return NextResponse.json({ ok: true, count: parsed.items.length });
}
