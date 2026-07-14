/**
 * GET    /api/bulletins/:id
 * PATCH  /api/bulletins/:id
 * DELETE /api/bulletins/:id
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("bulletins", "read");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const bulletin = await db.bulletin.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, role: true, avatarUrl: true } },
    },
  });
  if (!bulletin) return apiError("Buletin tidak dijumpai.", 404);
  return NextResponse.json({ bulletin });
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).optional(),
  category: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  publishedAt: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("bulletins", "write");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.bulletin.findUnique({ where: { id } });
  if (!existing) return apiError("Buletin tidak dijumpai.", 404);

  const body = await req.json().catch(() => null);
  const parsed = validateBody(updateSchema, body);
  if (parsed instanceof NextResponse) return parsed;

  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.body !== undefined) data.body = parsed.body;
  if (parsed.category !== undefined) data.category = parsed.category;
  if (parsed.imageUrl !== undefined) data.imageUrl = parsed.imageUrl;
  if (parsed.pinned !== undefined) data.pinned = parsed.pinned;
  if (parsed.archived !== undefined) data.archived = parsed.archived;
  if (parsed.publishedAt !== undefined) data.publishedAt = new Date(parsed.publishedAt);

  const bulletin = await db.bulletin.update({
    where: { id },
    data,
    include: { creator: { select: { id: true, name: true } } },
  });

  await audit(ctx, "bulletin.update", "bulletin", id, { changes: data });

  return NextResponse.json({ bulletin });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await requirePermission("bulletins", "delete");
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const existing = await db.bulletin.findUnique({ where: { id } });
  if (!existing) return apiError("Buletin tidak dijumpai.", 404);

  await db.bulletin.delete({ where: { id } });

  await audit(ctx, "bulletin.delete", "bulletin", id, { title: existing.title });

  return NextResponse.json({ ok: true });
}
