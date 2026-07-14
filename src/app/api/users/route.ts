/**
 * GET /api/users — list users (for assignee dropdowns etc.)
 * Requires `tasks:read` permission.
 */
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api/helpers";
import { db } from "@/lib/db";

export async function GET() {
  const ctx = await requirePermission("tasks", "read");
  if (ctx instanceof NextResponse) return ctx;

  const users = await db.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      unit: true,
      position: true,
      avatarUrl: true,
    },
    orderBy: [{ name: "asc" }],
  });
  return NextResponse.json({ users });
}
