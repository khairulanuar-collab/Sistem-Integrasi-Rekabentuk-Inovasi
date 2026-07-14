/**
 * GET /api/video-projects/:id/export
 * Returns JSON production specification package per PRD §6.1:
 *   { project, scenes, script, visualPrompts, assets, approvals }
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("video_projects", "read");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const project = await db.videoProject.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      scenes: { orderBy: { sceneOrder: "asc" } },
      assets: { orderBy: { createdAt: "desc" } },
      approvals: {
        orderBy: { createdAt: "desc" },
        include: { reviewer: { select: { id: true, name: true, role: true } } },
      },
    },
  });
  if (!project) return apiError("Projek video tidak dijumpai.", 404);

  const visualPrompts = project.scenes
    .map((s) => s.visualPrompt)
    .filter((p): p is string => Boolean(p));

  const exportPackage = {
    project: {
      id: project.id,
      title: project.title,
      theme: project.theme,
      description: project.description,
      status: project.status,
      scriptLang: project.scriptLang,
      creator: project.creator,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    script: project.script ?? "",
    scenes: project.scenes.map((s) => ({
      id: s.id,
      sceneOrder: s.sceneOrder,
      title: s.title,
      description: s.description,
      visualPrompt: s.visualPrompt,
      durationSec: s.durationSec,
      notes: s.notes,
    })),
    visualPrompts,
    assets: project.assets.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      assetType: a.assetType,
      fileSize: a.fileSize,
    })),
    approvals: project.approvals.map((a) => ({
      id: a.id,
      status: a.status,
      comment: a.comment,
      reviewedAt: a.reviewedAt,
      reviewer: a.reviewer,
    })),
    exportedAt: new Date().toISOString(),
    exportedBy: ctx.userId,
  };

  return NextResponse.json(exportPackage);
}
