/**
 * GET  /api/key-tasks — list KPI tasks (?status filter)
 * POST /api/key-tasks — create
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit } from "@/lib/api/helpers";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission("key_tasks", "read");
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const items = await db.keyTask.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ keyTasks: items });
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  target: z.string().optional(),
  kpi: z.string().optional(),
  achievementPct: z.number().int().min(0).max(100).optional(),
  unit: z.string().optional(),
  status: z.string().optional(),
  dueDate: z.string().optional(),
  ownerId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requirePermission("key_tasks", "write");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = validateBody(createSchema, body);
  if (parsed instanceof NextResponse) return parsed;

  const item = await db.keyTask.create({
    data: {
      title: parsed.title,
      description: parsed.description ?? null,
      target: parsed.target ?? null,
      kpi: parsed.kpi ?? null,
      achievementPct: parsed.achievementPct ?? 0,
      unit: parsed.unit ?? null,
      status: parsed.status ?? "on_track",
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
      ownerId: parsed.ownerId ?? null,
      createdById: ctx.userId,
    },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
    },
  });

  await audit(ctx, "key_task.create", "key_task", item.id, { title: item.title });

  return NextResponse.json({ keyTask: item }, { status: 201 });
}
