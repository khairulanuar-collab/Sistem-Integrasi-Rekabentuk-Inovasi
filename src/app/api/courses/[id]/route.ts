/**
 * GET /api/courses/:id — single course with modules (ordered),
 *   modules.lessons (ordered), modules.quizzes; include current user enrollment.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await requireAuth();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const course = await db.course.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { moduleOrder: "asc" },
        include: {
          lessons: { orderBy: { lessonOrder: "asc" } },
          quizzes: { orderBy: { createdAt: "asc" } },
        },
      },
      enrollments: {
        where: { userId: ctx.userId },
        select: {
          id: true,
          status: true,
          progressPct: true,
          score: true,
          enrolledAt: true,
          completedAt: true,
        },
      },
    },
  });
  if (!course) return apiError("Kursus tidak dijumpai.", 404);

  return NextResponse.json({
    course,
    myEnrollment: course.enrollments[0] ?? null,
  });
}
