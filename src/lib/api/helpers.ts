/**
 * SIRI-AI JTM — API helpers for auth, RBAC, validation, audit
 * Per PRD §12: All sensitive endpoints require authenticated session + role check.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canPerform, type Action, type Role } from "@/lib/security";
import { z, type ZodSchema } from "zod";

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  role: Role;
  unit?: string | null;
  position?: string | null;
}

export async function getSessionUser(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as any;
  return {
    userId: u.id,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    unit: u.unit ?? null,
    position: u.position ?? null,
  };
}

/**
 * Require authenticated session.
 * Returns AuthContext or a 401 NextResponse.
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const ctx = await getSessionUser();
  if (!ctx) {
    return NextResponse.json({ error: "Sesi tidak sah. Sila log masuk." }, { status: 401 });
  }
  return ctx;
}

/**
 * Require authenticated session AND permission for entity+action.
 * Per PRD §12 (RLS-equivalent at API layer).
 */
export async function requirePermission(
  entity: string,
  action: Action
): Promise<AuthContext | NextResponse> {
  const ctx = await requireAuth();
  if (ctx instanceof NextResponse) return ctx;
  if (!canPerform(entity, action, ctx.role)) {
    return NextResponse.json(
      { error: `Akses dinafikan. Peranan ${ctx.role} tidak dibenarkan untuk ${action} ${entity}.` },
      { status: 403 }
    );
  }
  return ctx;
}

/**
 * Validate request body with Zod. Returns parsed data or 400 NextResponse.
 */
export function validateBody<T>(schema: ZodSchema<T>, body: unknown): T | NextResponse {
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Data tidak sah", details: result.error.flatten() },
      { status: 400 }
    );
  }
  return result.data;
}

/**
 * Audit log helper — per PRD §12 (audit log for critical actions).
 */
export async function audit(
  ctx: AuthContext,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (e) {
    // Audit log failure must never break the user flow
    console.error("audit log failed", e);
  }
}

/**
 * Standard error response.
 */
export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

/**
 * Standard success response.
 */
export function apiOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
