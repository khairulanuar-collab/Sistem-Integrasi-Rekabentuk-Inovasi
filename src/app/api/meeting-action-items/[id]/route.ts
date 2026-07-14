/**
 * PATCH  /api/meeting-action-items/:id
 * DELETE /api/meeting-action-items/:id
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  completed: z.boolean().optional(),
  dueDate: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("meetings", "write");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.meetingActionItem.findUnique({ where: { id } });
  if (!existing) return apiError("Item tindakan tidak dijumpai.", 404);

  const body = await req.json().catch(() => null);
  const parsed = validateBody(updateSchema, body);
  if (parsed instanceof NextResponse) return parsed;

  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.completed !== undefined) data.completed = parsed.completed;
  if (parsed.dueDate !== undefined) data.dueDate = parsed.dueDate ? new Date(parsed.dueDate) : null;
  if (parsed.assigneeId !== undefined) data.assigneeId = parsed.assigneeId;

  const item = await db.meetingActionItem.update({
    where: { id },
    data,
    include: { assignee: { select: { id: true, name: true } } },
  });

  await audit(ctx, "action_item.update", "meeting_action_item", id, { changes: data });

  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("meetings", "delete");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.meetingActionItem.findUnique({ where: { id } });
  if (!existing) return apiError("Item tindakan tidak dijumpai.", 404);

  await db.meetingActionItem.delete({ where: { id } });

  await audit(ctx, "action_item.delete", "meeting_action_item", id, {
    title: existing.title,
  });

  return NextResponse.json({ ok: true });
}
