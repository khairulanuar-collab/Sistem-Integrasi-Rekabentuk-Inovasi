/**
 * GET /api/me — current user profile
 * Returns minimal user info from session (refreshed from DB).
 */
import { NextResponse } from "next/server";
import { getSessionUser, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

export async function GET() {
  const ctx = await getSessionUser();
  if (!ctx) {
    return apiError("Sesi tidak sah. Sila log masuk.", 401);
  }
  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      unit: true,
      position: true,
      avatarUrl: true,
    },
  });
  if (!user) {
    return apiError("Pengguna tidak dijumpai.", 404);
  }
  return NextResponse.json({ user });
}
