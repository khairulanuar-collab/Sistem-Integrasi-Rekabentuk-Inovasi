/**
 * GET /api/courses/:id/leaderboard — top 10 enrollments by score desc
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await requireAuth();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const course = await db.course.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!course) return apiError("Kursus tidak dijumpai.", 404);

  const enrollments = await db.enrollment.findMany({
    where: { courseId: id, status: "completed", score: { not: null } },
    orderBy: [{ score: "desc" }, { completedAt: "asc" }],
    take: 10,
    include: {
      user: { select: { id: true, name: true, unit: true, avatarUrl: true } },
    },
  });

  const leaderboard = enrollments.map((e, i) => ({
    rank: i + 1,
    enrollmentId: e.id,
    userId: e.user.id,
    name: e.user.name,
    unit: e.user.unit,
    avatarUrl: e.user.avatarUrl,
    score: e.score ?? 0,
    completedAt: e.completedAt,
  }));

  return NextResponse.json({ courseTitle: course.title, leaderboard });
}
