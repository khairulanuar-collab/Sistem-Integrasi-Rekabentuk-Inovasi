/**
 * GET  /api/meetings  — list meetings (?status filter)
 * POST /api/meetings  — create meeting (+ participants)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

// ------------------------------------------------------------
// GET
// ------------------------------------------------------------
export async function GET(req: NextRequest) {
  const ctx = await requirePermission("meetings", "read");
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const meetings = await db.meeting.findMany({
    where,
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true, unit: true } },
        },
      },
      actionItems: {
        include: {
          assignee: { select: { id: true, name: true } },
        },
      },
      creator: { select: { id: true, name: true } },
    },
    orderBy: { startsAt: "asc" },
  });
  return NextResponse.json({ meetings });
}

// ------------------------------------------------------------
// POST
// ------------------------------------------------------------
const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  location: z.string().optional(),
  meetingUrl: z.string().optional(),
  agenda: z.string().optional(),
  participantIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requirePermission("meetings", "write");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = validateBody(createSchema, body);
  if (parsed instanceof NextResponse) return parsed;

  const participantIds = Array.from(new Set(parsed.participantIds ?? []));

  const meeting = await db.meeting.create({
    data: {
      title: parsed.title,
      description: parsed.description ?? null,
      startsAt: new Date(parsed.startsAt),
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
      location: parsed.location ?? null,
      meetingUrl: parsed.meetingUrl ?? null,
      agenda: parsed.agenda ?? null,
      status: "scheduled",
      createdById: ctx.userId,
      participants:
        participantIds.length > 0
          ? {
              create: participantIds.map((userId) => ({ userId })),
            }
          : undefined,
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
        },
      },
    },
  });

  await audit(ctx, "meeting.create", "meeting", meeting.id, {
    title: meeting.title,
    participantCount: participantIds.length,
  });

  return NextResponse.json({ meeting }, { status: 201 });
}
