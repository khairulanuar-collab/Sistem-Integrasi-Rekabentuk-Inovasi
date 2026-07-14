/**
 * GET  /api/bulletins — list bulletins
 *      ?archived=true   include archived
 *      ?category=       filter by category
 *      ?pinned=true     pinned only
 * POST /api/bulletins — create (ADMIN/MANAGER only)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, validateBody, audit } from "@/lib/api/helpers";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission("bulletins", "read");
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const archived = searchParams.get("archived") === "true";
  const category = searchParams.get("category");
  const pinnedOnly = searchParams.get("pinned") === "true";

  const where: Record<string, unknown> = {};
  if (!archived) where.archived = false;
  if (category) where.category = category;
  if (pinnedOnly) where.pinned = true;

  const bulletins = await db.bulletin.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true, role: true, avatarUrl: true } },
    },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
  });
  return NextResponse.json({ bulletins });
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  category: z.string().optional(),
  imageUrl: z.string().optional(),
  pinned: z.boolean().optional(),
  publishedAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requirePermission("bulletins", "write");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = validateBody(createSchema, body);
  if (parsed instanceof NextResponse) return parsed;

  const bulletin = await db.bulletin.create({
    data: {
      title: parsed.title,
      body: parsed.body,
      category: parsed.category ?? "Pengumuman Rasmi",
      imageUrl: parsed.imageUrl ?? null,
      pinned: parsed.pinned ?? false,
      publishedAt: parsed.publishedAt ? new Date(parsed.publishedAt) : new Date(),
      createdById: ctx.userId,
    },
    include: {
      creator: { select: { id: true, name: true, role: true, avatarUrl: true } },
    },
  });

  await audit(ctx, "bulletin.create", "bulletin", bulletin.id, { title: bulletin.title });

  return NextResponse.json({ bulletin }, { status: 201 });
}
