/**
 * SIRI-AI JTM — NextAuth Configuration
 * Credentials provider with PBKDF2-style password hashing (sha256+salt).
 * Session JWT includes user role for client-side RBAC.
 *
 * Per PRD §12 (Keselamatan):
 *  - JWT-based session with expiry
 *  - Role-based access control enforced in API routes
 *  - Audit log on each login
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword, type Role } from "@/lib/security";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "JTM SIRI-AI",
      credentials: {
        email: { label: "E-mel", type: "email", placeholder: "admin@jtm.gov.my" },
        password: { label: "Kata Laluan", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();
        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            unit: true,
            position: true,
            passwordHash: true,
            active: true,
            avatarUrl: true,
          },
        });
        if (!user) return null;
        if (!user.active) return null;
        if (!verifyPassword(credentials.password, user.passwordHash)) return null;

        // Update last login timestamp
        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: "auth.login",
            entityType: "user",
            entityId: user.id,
            metadata: JSON.stringify({ email: user.email, role: user.role }),
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          unit: user.unit,
          position: user.position,
          avatarUrl: user.avatarUrl,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — PRD §12: expiring session
    updateAge: 30 * 60,
  },
  jwt: {
    maxAge: 8 * 60 * 60,
  },
  pages: {
    signIn: "/",
    signOut: "/",
    error: "/",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.unit = (user as any).unit;
        token.position = (user as any).position;
        token.avatarUrl = (user as any).avatarUrl;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).unit = token.unit;
        (session.user as any).position = token.position;
        (session.user as any).avatarUrl = token.avatarUrl;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "siri-ai-jtm-dev-secret-2026-not-for-production",
};

// Type augmentation for next-auth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      unit?: string | null;
      position?: string | null;
      avatarUrl?: string | null;
    };
  }
  interface User {
    role?: Role;
    unit?: string | null;
    position?: string | null;
    avatarUrl?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    unit?: string | null;
    position?: string | null;
    avatarUrl?: string | null;
  }
}
