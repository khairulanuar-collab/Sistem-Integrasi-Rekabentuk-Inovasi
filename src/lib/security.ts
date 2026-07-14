/**
 * SIRI-AI JTM — Security utilities
 * Provides password hashing (sha256 + salt for demo), CSRF-safe ID generation,
 * input validation helpers, and rate limiting primitives.
 *
 * NOTE: For production, replace hashPassword with bcrypt/argon2. The sha256
 * approach here is intentionally simple to avoid native-binding issues in the
 * sandbox. The hash function is consistent (deterministic) so seed users can
 * be verified by the same function.
 */
import { createHash, randomBytes } from "crypto";

const SALT = "siri-ai-jtm-salt-v1";

export function hashPassword(password: string): string {
  return createHash("sha256").update(SALT + ":" + password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

// ============================================================
// Rate limiting (per PRD §10.2: rate-limit AI endpoints)
// Simple in-memory token bucket keyed by userId+endpoint
// ============================================================

interface RateBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, RateBucket>();

/**
 * Token-bucket rate limiter.
 * @param key     unique key (e.g. `ai:${userId}`)
 * @param maxTokens  bucket capacity
 * @param refillPerMin  tokens added per minute
 * @returns true if request is allowed, false if rate-limited
 */
export function rateLimit(key: string, maxTokens = 10, refillPerMin = 10): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: maxTokens, lastRefill: now };
  // Refill
  const minutesPassed = (now - bucket.lastRefill) / 60000;
  bucket.tokens = Math.min(maxTokens, bucket.tokens + minutesPassed * refillPerMin);
  bucket.lastRefill = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}

// ============================================================
// Role-based access control (per PRD §3)
// ============================================================

export type Role = "ADMIN" | "MANAGER" | "OFFICER" | "CREATIVE" | "TRAINEE" | "VISITOR";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Pentadbir Sistem",
  MANAGER: "Pengurus / Ketua Jabatan",
  OFFICER: "Pegawai / Eksekutif",
  CREATIVE: "Krew Kreatif",
  TRAINEE: "Pelatih / Peserta Kursus",
  VISITOR: "Pelawat (Baca Sahaja)",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Ketua unit ICT / pentadbir aplikasi — akses penuh",
  MANAGER: "Pegawai kanan yang memantau operasi — dashboard penuh & kelulusan",
  OFFICER: "Kakitangan pelaksana harian — perancangan kerja & mesyuarat",
  CREATIVE: "Pasukan pembangunan video Kemerdekaan — Modul 1 penuh",
  TRAINEE: "Kakitangan/pelatih mengikuti kursus dron — Modul 3 sahaja",
  VISITOR: "Pihak berkepentingan luar — paparan buletin awam sahaja",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && value in ROLE_LABELS;
}

/**
 * Module access matrix per PRD §3.
 * Defines which roles can access (read) each module.
 */
export const MODULE_ACCESS: Record<string, Role[]> = {
  dashboard: ["ADMIN", "MANAGER", "OFFICER", "CREATIVE", "TRAINEE"],
  video_studio: ["ADMIN", "MANAGER", "CREATIVE"],
  elearning: ["ADMIN", "MANAGER", "OFFICER", "CREATIVE", "TRAINEE"],
  bulletins: ["ADMIN", "MANAGER", "OFFICER", "CREATIVE", "TRAINEE", "VISITOR"],
};

export function canAccessModule(module: string, role: Role | undefined | null): boolean {
  if (!role) return false;
  const allowed = MODULE_ACCESS[module];
  if (!allowed) return false;
  return allowed.includes(role);
}

/**
 * Permission matrix — write-level actions per PRD §3.
 * read = can view; write = can create/update/delete; approve = can approve/reject
 */
export type Action = "read" | "write" | "approve" | "delete" | "admin";

const PERMISSIONS: Record<string, Partial<Record<Action, Role[]>>> = {
  tasks: {
    read: ["ADMIN", "MANAGER", "OFFICER", "CREATIVE"],
    write: ["ADMIN", "MANAGER", "OFFICER", "CREATIVE"],
    delete: ["ADMIN", "MANAGER"],
  },
  meetings: {
    read: ["ADMIN", "MANAGER", "OFFICER", "CREATIVE"],
    write: ["ADMIN", "MANAGER", "OFFICER"],
    delete: ["ADMIN", "MANAGER"],
  },
  key_tasks: {
    read: ["ADMIN", "MANAGER", "OFFICER"],
    write: ["ADMIN", "MANAGER"],
    delete: ["ADMIN"],
  },
  bulletins: {
    read: ["ADMIN", "MANAGER", "OFFICER", "CREATIVE", "TRAINEE", "VISITOR"],
    write: ["ADMIN", "MANAGER"],
    delete: ["ADMIN"],
  },
  video_projects: {
    read: ["ADMIN", "MANAGER", "CREATIVE"],
    write: ["ADMIN", "MANAGER", "CREATIVE"],
    approve: ["ADMIN", "MANAGER"],
    delete: ["ADMIN"],
  },
  courses: {
    read: ["ADMIN", "MANAGER", "OFFICER", "CREATIVE", "TRAINEE"],
    write: ["ADMIN", "MANAGER"],
    delete: ["ADMIN"],
  },
  ai_generate: {
    read: ["ADMIN", "MANAGER", "OFFICER", "CREATIVE"],
  },
  audit_logs: {
    read: ["ADMIN"],
  },
};

export function canPerform(entity: string, action: Action, role: Role | undefined | null): boolean {
  if (!role) return false;
  const perm = PERMISSIONS[entity];
  if (!perm) return false;
  const allowed = perm[action];
  if (!allowed) return false;
  return allowed.includes(role);
}
