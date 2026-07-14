/**
 * GET  /api/video-projects — list projects (?status filter)
 * POST /api/video-projects — create
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit } from "@/lib/api/helpers";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission("video_projects", "read");
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const projects = await db.videoProject.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true, role: true, avatarUrl: true } },
      _count: { select: { scenes: true, assets: true, approvals: true } },
      approvals: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          comment: true,
          reviewedAt: true,
          reviewer: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ projects });
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  theme: z.string().min(1).max(200),
  description: z.string().optional(),
  scriptLang: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requirePermission("video_projects", "write");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = validateBody(createSchema, body);
  if (parsed instanceof NextResponse) return parsed;

  const project = await db.videoProject.create({
    data: {
      title: parsed.title,
      theme: parsed.theme,
      description: parsed.description ?? null,
      scriptLang: parsed.scriptLang ?? "ms",
      status: "draft",
      createdById: ctx.userId,
    },
    include: {
      creator: { select: { id: true, name: true } },
    },
  });

  await audit(ctx, "video_project.create", "video_project", project.id, {
    title: project.title,
    theme: project.theme,
  });

  return NextResponse.json({ project }, { status: 201 });
}
