/**
 * POST /api/quizzes/:id/attempt
 * Body: { selectedAnswer: number, enrollmentId?: string }
 *
 * Records QuizAttempt (isCorrect computed from quiz.correctAnswer).
 * If enrollmentId provided:
 *   - recompute enrollment progressPct (% of course quizzes attempted)
 *   - if all quizzes attempted AND overall score >= 70%:
 *       mark enrollment completed, set score + completedAt,
 *       auto-issue Certificate (certificateNo = SIRI-AI-DRONE-YYYY-####)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  selectedAnswer: z.number().int().min(0),
  enrollmentId: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireAuth();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = validateBody(schema, body);
  if (parsed instanceof NextResponse) return parsed;

  // Load quiz + course context
  const quiz = await db.quiz.findUnique({
    where: { id },
    include: {
      module: { select: { id: true, courseId: true } },
    },
  });
  if (!quiz) return apiError("Kuiz tidak dijumpai.", 404);

  const courseId = quiz.module.courseId;
  const isCorrect = parsed.selectedAnswer === quiz.correctAnswer;

  // Resolve enrollment (optional)
  let enrollment: Awaited<ReturnType<typeof db.enrollment.findUnique>> = null;
  if (parsed.enrollmentId) {
    enrollment = await db.enrollment.findUnique({
      where: { id: parsed.enrollmentId },
    });
    if (!enrollment) return apiError("Pendaftaran kursus tidak dijumpai.", 404);
    if (enrollment.userId !== ctx.userId) {
      return apiError("Pendaftaran ini bukan milik anda.", 403);
    }
    if (enrollment.courseId !== courseId) {
      return apiError("Kuiz ini bukan sebahagian daripada kursus pendaftaran.", 400);
    }
  }

  // Record attempt
  const attempt = await db.quizAttempt.create({
    data: {
      quizId: id,
      userId: ctx.userId,
      enrollmentId: enrollment?.id ?? null,
      selectedAnswer: parsed.selectedAnswer,
      isCorrect,
    },
  });

  await audit(ctx, "quiz.attempt", "quiz", id, {
    selectedAnswer: parsed.selectedAnswer,
    isCorrect,
    enrollmentId: enrollment?.id ?? null,
  });

  // If not tied to enrollment, return early
  if (!enrollment) {
    return NextResponse.json({ attempt, isCorrect, correctAnswer: quiz.correctAnswer });
  }

  // If already completed, do not re-issue certificate
  if (enrollment.status === "completed") {
    return NextResponse.json({
      attempt,
      isCorrect,
      correctAnswer: quiz.correctAnswer,
      enrollment: { ...enrollment, alreadyCompleted: true },
    });
  }

  // Get all quizzes in the course
  const courseQuizzes = await db.quiz.findMany({
    where: { module: { courseId } },
    select: { id: true },
  });
  const totalQuizzes = courseQuizzes.length;
  const quizIds = courseQuizzes.map((q) => q.id);

  // Find the latest attempt per quiz (for this user within this enrollment)
  // We aggregate all attempts and pick the most recent per quizId.
  const allAttempts = await db.quizAttempt.findMany({
    where: {
      userId: ctx.userId,
      quizId: { in: quizIds },
      // include attempts for this enrollment, plus any without enrollment tied
      OR: [{ enrollmentId: enrollment.id }, { enrollmentId: null }],
    },
    orderBy: { attemptedAt: "desc" },
    select: { quizId: true, isCorrect: true, attemptedAt: true },
  });

  const latestPerQuiz = new Map<string, boolean>();
  for (const a of allAttempts) {
    if (!latestPerQuiz.has(a.quizId)) {
      latestPerQuiz.set(a.quizId, a.isCorrect);
    }
  }

  const attemptedCount = latestPerQuiz.size;
  const correctCount = Array.from(latestPerQuiz.values()).filter(Boolean).length;
  const progressPct = totalQuizzes === 0 ? 0 : Math.round((attemptedCount / totalQuizzes) * 100);
  const scorePct = attemptedCount === 0 ? 0 : Math.round((correctCount / totalQuizzes) * 100);

  const allAttempted = attemptedCount >= totalQuizzes && totalQuizzes > 0;
  const passed = scorePct >= 70;

  let updatedEnrollment = await db.enrollment.update({
    where: { id: enrollment.id },
    data: { progressPct },
  });

  let certificate: Awaited<ReturnType<typeof db.certificate.create>> | null = null;

  if (allAttempted && passed) {
    const completedAt = new Date();
    const year = completedAt.getFullYear();

    // Generate next certificate number: SIRI-AI-DRONE-YYYY-####
    // Use a count-based approach inside a transaction to avoid collisions.
    updatedEnrollment = await db.$transaction(async (tx) => {
      // lock-ish: count existing certificates for this year
      const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
      const yearEnd = new Date(year + 1, 0, 1, 0, 0, 0, 0);
      const countThisYear = await tx.certificate.count({
        where: { issuedAt: { gte: yearStart, lt: yearEnd } },
      });
      const sequence = (countThisYear + 1).toString().padStart(4, "0");
      const certificateNo = `SIRI-AI-DRONE-${year}-${sequence}`;

      certificate = await tx.certificate.create({
        data: {
          enrollmentId: enrollment.id,
          certificateNo,
          issuedAt: completedAt,
          score: scorePct,
        },
      });

      return await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "completed",
          score: scorePct,
          progressPct: 100,
          completedAt,
        },
      });
    });

    await audit(ctx, "certificate.issue", "certificate", certificate!.id, {
      enrollmentId: enrollment.id,
      courseId,
      score: scorePct,
      certificateNo: certificate!.certificateNo,
    });
  }

  return NextResponse.json({
    attempt,
    isCorrect,
    correctAnswer: quiz.correctAnswer,
    enrollment: updatedEnrollment,
    certificate: certificate ?? null,
    summary: {
      attemptedCount,
      totalQuizzes,
      correctCount,
      scorePct,
      progressPct,
      passed: allAttempted && passed,
    },
  });
}
