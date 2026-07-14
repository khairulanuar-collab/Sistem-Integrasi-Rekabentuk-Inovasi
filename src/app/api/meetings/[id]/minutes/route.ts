/**
 * POST /api/meetings/:id/minutes — update meeting minutes
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  minutes: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("meetings", "write");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.meeting.findUnique({ where: { id } });
  if (!existing) return apiError("Mesyuarat tidak dijumpai.", 404);

  const body = await req.json().catch(() => null);
  const parsed = validateBody(schema, body);
  if (parsed instanceof NextResponse) return parsed;

  const meeting = await db.meeting.update({
    where: { id },
    data: { minutes: parsed.minutes },
  });

  await audit(ctx, "meeting.minutes_update", "meeting", id, {
    minutesLength: parsed.minutes.length,
  });

  return NextResponse.json({ meeting });
}
