/**
 * POST /api/meeting-action-items — create action item
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

const schema = z.object({
  meetingId: z.string().min(1),
  title: z.string().min(1).max(300),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requirePermission("meetings", "write");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = validateBody(schema, body);
  if (parsed instanceof NextResponse) return parsed;

  const meeting = await db.meeting.findUnique({ where: { id: parsed.meetingId } });
  if (!meeting) return apiError("Mesyuarat tidak dijumpai.", 404);

  const item = await db.meetingActionItem.create({
    data: {
      meetingId: parsed.meetingId,
      title: parsed.title,
      assigneeId: parsed.assigneeId ?? null,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
    },
    include: { assignee: { select: { id: true, name: true } } },
  });

  await audit(ctx, "action_item.create", "meeting_action_item", item.id, {
    meetingId: parsed.meetingId,
    title: parsed.title,
  });

  return NextResponse.json({ item }, { status: 201 });
}
