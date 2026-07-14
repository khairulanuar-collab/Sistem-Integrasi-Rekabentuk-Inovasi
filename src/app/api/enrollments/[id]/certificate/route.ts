/**
 * GET /api/enrollments/:id/certificate — certificate data for completed enrollment
 * Returns: { certificateNo, issuedAt, score, user, course }
 * If no certificate → 404.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await requireAuth();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  const enrollment = await db.enrollment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, unit: true, position: true, email: true } },
      course: { select: { id: true, title: true, level: true } },
      certificates: { select: { id: true, certificateNo: true, issuedAt: true, score: true, certificateUrl: true } },
    },
  });

  if (!enrollment) return apiError("Pendaftaran kursus tidak dijumpai.", 404);

  // Only the owner (or ADMIN) may view certificate
  if (enrollment.userId !== ctx.userId && ctx.role !== "ADMIN") {
    return apiError("Akses dinafikan.", 403);
  }

  const certificate = enrollment.certificates[0];
  if (!certificate) {
    return apiError("Sijil belum diterbitkan. Selesaikan kursus dengan skor ≥ 70%.", 404);
  }

  return NextResponse.json({
    certificate: {
      id: certificate.id,
      certificateNo: certificate.certificateNo,
      issuedAt: certificate.issuedAt,
      score: certificate.score,
      certificateUrl: certificate.certificateUrl,
    },
    user: enrollment.user,
    course: enrollment.course,
    enrollment: {
      id: enrollment.id,
      completedAt: enrollment.completedAt,
      status: enrollment.status,
    },
  });
}
