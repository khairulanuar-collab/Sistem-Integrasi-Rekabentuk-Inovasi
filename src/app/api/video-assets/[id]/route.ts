/**
 * DELETE /api/video-assets/:id
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("video_projects", "write");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.videoAsset.findUnique({ where: { id } });
  if (!existing) return apiError("Aset tidak dijumpai.", 404);

  await db.videoAsset.delete({ where: { id } });

  await audit(ctx, "asset.delete", "video_asset", id, {
    fileName: existing.fileName,
    projectId: existing.projectId,
  });

  return NextResponse.json({ ok: true });
}
