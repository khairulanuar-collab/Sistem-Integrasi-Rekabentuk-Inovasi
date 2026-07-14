/**
 * PATCH  /api/key-tasks/:id
 * DELETE /api/key-tasks/:id
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  target: z.string().nullable().optional(),
  kpi: z.string().nullable().optional(),
  achievementPct: z.number().int().min(0).max(100).optional(),
  unit: z.string().nullable().optional(),
  status: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("key_tasks", "write");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.keyTask.findUnique({ where: { id } });
  if (!existing) return apiError("Kerja utama tidak dijumpai.", 404);

  const body = await req.json().catch(() => null);
  const parsed = validateBody(updateSchema, body);
  if (parsed instanceof NextResponse) return parsed;

  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.description !== undefined) data.description = parsed.description;
  if (parsed.target !== undefined) data.target = parsed.target;
  if (parsed.kpi !== undefined) data.kpi = parsed.kpi;
  if (parsed.achievementPct !== undefined) data.achievementPct = parsed.achievementPct;
  if (parsed.unit !== undefined) data.unit = parsed.unit;
  if (parsed.status !== undefined) data.status = parsed.status;
  if (parsed.dueDate !== undefined) data.dueDate = parsed.dueDate ? new Date(parsed.dueDate) : null;
  if (parsed.ownerId !== undefined) data.ownerId = parsed.ownerId;

  const item = await db.keyTask.update({
    where: { id },
    data,
    include: {
      owner: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
    },
  });

  await audit(ctx, "key_task.update", "key_task", id, { changes: data });

  return NextResponse.json({ keyTask: item });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("key_tasks", "delete");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.keyTask.findUnique({ where: { id } });
  if (!existing) return apiError("Kerja utama tidak dijumpai.", 404);

  await db.keyTask.delete({ where: { id } });

  await audit(ctx, "key_task.delete", "key_task", id, { title: existing.title });

  return NextResponse.json({ ok: true });
}
