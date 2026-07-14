/**
 * GET /api/courses — list courses with module count + user's enrollment status
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/helpers";
import { db } from "@/lib/db";

export async function GET() {
  const ctx = await requireAuth();
  if (ctx instanceof NextResponse) return ctx;

  const courses = await db.course.findMany({
    include: {
      _count: { select: { modules: true, enrollments: true } },
      enrollments: {
        where: { userId: ctx.userId },
        select: { id: true, status: true, progressPct: true, score: true, completedAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const result = courses.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    level: c.level,
    thumbnailUrl: c.thumbnailUrl,
    moduleCount: c._count.modules,
    totalEnrolled: c._count.enrollments,
    myEnrollment: c.enrollments[0] ?? null,
  }));

  return NextResponse.json({ courses: result });
}
