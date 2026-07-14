/**
 * GET    /api/tasks/:id
 * PATCH  /api/tasks/:id
 * DELETE /api/tasks/:id
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// ------------------------------------------------------------
// GET
// ------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("tasks", "read");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const task = await db.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, email: true, role: true, avatarUrl: true, unit: true } },
      creator: { select: { id: true, name: true } },
    },
  });
  if (!task) return apiError("Tugas tidak dijumpai.", 404);
  return NextResponse.json({ task });
}

// ------------------------------------------------------------
// PATCH
// ------------------------------------------------------------
const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  unit: z.string().nullable().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  dueDate: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("tasks", "write");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) return apiError("Tugas tidak dijumpai.", 404);

  const body = await req.json().catch(() => null);
  const parsed = validateBody(updateSchema, body);
  if (parsed instanceof NextResponse) return parsed;

  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.description !== undefined) data.description = parsed.description;
  if (parsed.status !== undefined) data.status = parsed.status;
  if (parsed.priority !== undefined) data.priority = parsed.priority;
  if (parsed.unit !== undefined) data.unit = parsed.unit;
  if (parsed.progress !== undefined) data.progress = parsed.progress;
  if (parsed.dueDate !== undefined) data.dueDate = parsed.dueDate ? new Date(parsed.dueDate) : null;
  if (parsed.assigneeId !== undefined) data.assigneeId = parsed.assigneeId;

  const task = await db.task.update({
    where: { id },
    data,
    include: {
      assignee: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
    },
  });

  await audit(ctx, "task.update", "task", task.id, { changes: data });

  return NextResponse.json({ task });
}

// ------------------------------------------------------------
// DELETE
// ------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("tasks", "delete");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) return apiError("Tugas tidak dijumpai.", 404);

  await db.task.delete({ where: { id } });

  await audit(ctx, "task.delete", "task", id, { title: existing.title });

  return NextResponse.json({ ok: true });
}
