/**
 * POST /api/bulletins/:id/pin — toggle pinned
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("bulletins", "write");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.bulletin.findUnique({ where: { id } });
  if (!existing) return apiError("Buletin tidak dijumpai.", 404);

  const bulletin = await db.bulletin.update({
    where: { id },
    data: { pinned: !existing.pinned },
  });

  await audit(ctx, "bulletin.pin", "bulletin", id, { pinned: bulletin.pinned });

  return NextResponse.json({ bulletin });
}
