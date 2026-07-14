/**
 * GET /api/tasks  — list tasks with filters (?status, ?priority, ?unit)
 * POST /api/tasks — create task
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

// ------------------------------------------------------------
// GET
// ------------------------------------------------------------
export async function GET(req: NextRequest) {
  const ctx = await requirePermission("tasks", "read");
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const unit = searchParams.get("unit");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (unit) where.unit = unit;

  const tasks = await db.task.findMany({
    where,
    include: {
      assignee: {
        select: { id: true, name: true, email: true, role: true, avatarUrl: true, unit: true },
      },
      creator: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ tasks });
}

// ------------------------------------------------------------
// POST
// ------------------------------------------------------------
const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  unit: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requirePermission("tasks", "write");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = validateBody(createSchema, body);
  if (parsed instanceof NextResponse) return parsed;

  const task = await db.task.create({
    data: {
      title: parsed.title,
      description: parsed.description ?? null,
      status: parsed.status ?? "todo",
      priority: parsed.priority ?? "medium",
      unit: parsed.unit ?? null,
      progress: parsed.progress ?? 0,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
      assigneeId: parsed.assigneeId ?? null,
      createdById: ctx.userId,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
    },
  });

  await audit(ctx, "task.create", "task", task.id, { title: task.title });

  return NextResponse.json({ task }, { status: 201 });
}
