/**
 * POST /api/video-projects/:id/approve
 * Body: { status: "approved" | "rejected" | "changes_requested", comment? }
 * Creates VideoApproval, updates project status accordingly.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum(["approved", "rejected", "changes_requested"]),
  comment: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("video_projects", "approve");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.videoProject.findUnique({ where: { id } });
  if (!existing) return apiError("Projek video tidak dijumpai.", 404);

  const body = await req.json().catch(() => null);
  const parsed = validateBody(schema, body);
  if (parsed instanceof NextResponse) return parsed;

  const projectStatus =
    parsed.status === "approved"
      ? "approved"
      : parsed.status === "rejected"
      ? "draft"
      : "in_review";

  const [approval, project] = await db.$transaction([
    db.videoApproval.create({
      data: {
        projectId: id,
        reviewerId: ctx.userId,
        status: parsed.status,
        comment: parsed.comment ?? null,
        reviewedAt: new Date(),
      },
      include: {
        reviewer: { select: { id: true, name: true, role: true } },
      },
    }),
    db.videoProject.update({
      where: { id },
      data: { status: projectStatus },
      include: {
        creator: { select: { id: true, name: true } },
      },
    }),
  ]);

  await audit(ctx, "video.approve", "video_project", id, {
    approvalStatus: parsed.status,
    projectStatus,
    comment: parsed.comment,
  });

  return NextResponse.json({ approval, project });
}
