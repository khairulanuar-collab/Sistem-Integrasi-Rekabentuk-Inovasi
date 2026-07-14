/**
 * GET /api/enrollments/mine — current user's enrollments
 *   with course title, progress, status, certificate
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/helpers";
import { db } from "@/lib/db";

export async function GET() {
  const ctx = await requireAuth();
  if (ctx instanceof NextResponse) return ctx;

  const enrollments = await db.enrollment.findMany({
    where: { userId: ctx.userId },
    include: {
      course: {
        select: { id: true, title: true, description: true, level: true, thumbnailUrl: true },
      },
      certificates: { select: { id: true, certificateNo: true, issuedAt: true, score: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const result = enrollments.map((e) => ({
    id: e.id,
    courseId: e.courseId,
    course: e.course,
    status: e.status,
    progressPct: e.progressPct,
    score: e.score,
    enrolledAt: e.enrolledAt,
    completedAt: e.completedAt,
    certificate: e.certificates[0] ?? null,
  }));

  return NextResponse.json({ enrollments: result });
}
