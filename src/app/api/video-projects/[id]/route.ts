/**
 * GET    /api/video-projects/:id
 * PATCH  /api/video-projects/:id
 * DELETE /api/video-projects/:id
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("video_projects", "read");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const project = await db.videoProject.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, role: true, avatarUrl: true } },
      scenes: { orderBy: { sceneOrder: "asc" } },
      assets: { orderBy: { createdAt: "desc" } },
      approvals: {
        orderBy: { createdAt: "desc" },
        include: { reviewer: { select: { id: true, name: true, role: true } } },
      },
    },
  });
  if (!project) return apiError("Projek video tidak dijumpai.", 404);
  return NextResponse.json({ project });
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  theme: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  conceptNotes: z.string().nullable().optional(),
  script: z.string().nullable().optional(),
  scriptLang: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("video_projects", "write");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.videoProject.findUnique({ where: { id } });
  if (!existing) return apiError("Projek video tidak dijumpai.", 404);

  const body = await req.json().catch(() => null);
  const parsed = validateBody(updateSchema, body);
  if (parsed instanceof NextResponse) return parsed;

  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.theme !== undefined) data.theme = parsed.theme;
  if (parsed.description !== undefined) data.description = parsed.description;
  if (parsed.status !== undefined) data.status = parsed.status;
  if (parsed.conceptNotes !== undefined) data.conceptNotes = parsed.conceptNotes;
  if (parsed.script !== undefined) data.script = parsed.script;
  if (parsed.scriptLang !== undefined) data.scriptLang = parsed.scriptLang;

  const project = await db.videoProject.update({
    where: { id },
    data,
    include: { creator: { select: { id: true, name: true } } },
  });

  await audit(ctx, "video_project.update", "video_project", id, { changes: data });

  return NextResponse.json({ project });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("video_projects", "delete");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.videoProject.findUnique({ where: { id } });
  if (!existing) return apiError("Projek video tidak dijumpai.", 404);

  await db.videoProject.delete({ where: { id } });

  await audit(ctx, "video_project.delete", "video_project", id, { title: existing.title });

  return NextResponse.json({ ok: true });
}
