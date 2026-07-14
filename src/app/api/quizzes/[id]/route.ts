/**
 * GET /api/quizzes/:id — single quiz (instructor preview)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await requireAuth();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const quiz = await db.quiz.findUnique({
    where: { id },
    include: {
      module: {
        select: {
          id: true,
          title: true,
          course: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (!quiz) return apiError("Kuiz tidak dijumpai.", 404);

  return NextResponse.json({ quiz });
}
