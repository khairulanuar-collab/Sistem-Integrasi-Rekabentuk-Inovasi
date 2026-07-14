/**
 * POST /api/video-assets — create asset metadata (no file upload in demo)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

const schema = z.object({
  projectId: z.string().min(1),
  fileName: z.string().min(1).max(300),
  fileUrl: z.string().min(1),
  assetType: z.enum(["image", "video", "audio", "document", "logo"]).optional(),
  fileSize: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requirePermission("video_projects", "write");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = validateBody(schema, body);
  if (parsed instanceof NextResponse) return parsed;

  const project = await db.videoProject.findUnique({ where: { id: parsed.projectId } });
  if (!project) return apiError("Projek video tidak dijumpai.", 404);

  const asset = await db.videoAsset.create({
    data: {
      projectId: parsed.projectId,
      fileName: parsed.fileName,
      fileUrl: parsed.fileUrl,
      assetType: parsed.assetType ?? "image",
      fileSize: parsed.fileSize ?? null,
      uploadedById: ctx.userId,
    },
  });

  await audit(ctx, "asset.create", "video_asset", asset.id, {
    projectId: parsed.projectId,
    fileName: parsed.fileName,
    assetType: asset.assetType,
  });

  return NextResponse.json({ asset }, { status: 201 });
}
