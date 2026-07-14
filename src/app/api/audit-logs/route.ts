/**
 * GET /api/audit-logs — recent audit logs (ADMIN only)
 * Query: ?limit=50 (max 200)
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api/helpers";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission("audit_logs", "read");
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const limitParam = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

  const logs = await db.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });
  return NextResponse.json({ logs });
}
