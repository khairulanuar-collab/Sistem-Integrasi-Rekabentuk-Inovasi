/**
 * POST /api/courses/:id/enroll — enroll current user (idempotent)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, audit } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const ctx = await requireAuth();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const course = await db.course.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!course) return apiError("Kursus tidak dijumpai.", 404);

  // Find or create enrollment (idempotent — @@unique([courseId, userId]))
  const existing = await db.enrollment.findUnique({
    where: { courseId_userId: { courseId: id, userId: ctx.userId } },
  });

  let enrollment = existing;
  if (!existing) {
    enrollment = await db.enrollment.create({
      data: {
        courseId: id,
        userId: ctx.userId,
        status: "in_progress",
        progressPct: 0,
      },
    });
    await audit(ctx, "course.enroll", "enrollment", enrollment.id, {
      courseId: id,
      courseTitle: course.title,
    });
  }

  return NextResponse.json({ enrollment });
}
