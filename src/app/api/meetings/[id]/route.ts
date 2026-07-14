/**
 * GET    /api/meetings/:id
 * PATCH  /api/meetings/:id
 * DELETE /api/meetings/:id
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
  const ctx = await requirePermission("meetings", "read");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const meeting = await db.meeting.findUnique({
    where: { id },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true, unit: true } },
        },
      },
      actionItems: {
        include: { assignee: { select: { id: true, name: true } } },
      },
      creator: { select: { id: true, name: true } },
    },
  });
  if (!meeting) return apiError("Mesyuarat tidak dijumpai.", 404);
  return NextResponse.json({ meeting });
}

// ------------------------------------------------------------
// PATCH
// ------------------------------------------------------------
const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  meetingUrl: z.string().nullable().optional(),
  agenda: z.string().nullable().optional(),
  status: z.string().optional(),
  participantIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("meetings", "write");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.meeting.findUnique({ where: { id } });
  if (!existing) return apiError("Mesyuarat tidak dijumpai.", 404);

  const body = await req.json().catch(() => null);
  const parsed = validateBody(updateSchema, body);
  if (parsed instanceof NextResponse) return parsed;

  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.description !== undefined) data.description = parsed.description;
  if (parsed.startsAt !== undefined) data.startsAt = new Date(parsed.startsAt);
  if (parsed.endsAt !== undefined) data.endsAt = parsed.endsAt ? new Date(parsed.endsAt) : null;
  if (parsed.location !== undefined) data.location = parsed.location;
  if (parsed.meetingUrl !== undefined) data.meetingUrl = parsed.meetingUrl;
  if (parsed.agenda !== undefined) data.agenda = parsed.agenda;
  if (parsed.status !== undefined) data.status = parsed.status;

  // Replace participants if provided
  let participantCount: number | undefined;
  if (parsed.participantIds !== undefined) {
    const participantIds = Array.from(new Set(parsed.participantIds));
    participantCount = participantIds.length;
    await db.meetingParticipant.deleteMany({ where: { meetingId: id } });
    if (participantIds.length > 0) {
      await db.meetingParticipant.createMany({
        data: participantIds.map((userId) => ({ meetingId: id, userId })),
      });
    }
  }

  const meeting = await db.meeting.update({
    where: { id },
    data,
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
        },
      },
    },
  });

  await audit(ctx, "meeting.update", "meeting", meeting.id, {
    changes: data,
    participantCount,
  });

  return NextResponse.json({ meeting });
}

// ------------------------------------------------------------
// DELETE
// ------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("meetings", "delete");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.meeting.findUnique({ where: { id } });
  if (!existing) return apiError("Mesyuarat tidak dijumpai.", 404);

  await db.meeting.delete({ where: { id } });

  await audit(ctx, "meeting.delete", "meeting", id, { title: existing.title });

  return NextResponse.json({ ok: true });
}
