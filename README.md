# 🇲🇾 SIRI-AI · JTM

**Sistem Integrasi Rekabentik & Inovasi — Jabatan Tenaga Manusia Malaysia**

> A modern, secure, glassmorphism-styled web application for Jabatan Tenaga Manusia (JTM) that integrates three mission-critical modules: AI-powered Merdeka video production, an operations dashboard, and a Drone for Beginner e-learning course.

Built per **Product Requirements Document v1.0** (14 Julai 2026) for Jabatan Tenaga Manusia, Kementerian Sumber Manusia Malaysia.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Demo Accounts](#demo-accounts)
- [Local Development](#local-development)
- [Database Setup (Supabase)](#database-setup-supabase)
- [Deployment (Vercel)](#deployment-vercel)
- [Security](#security)
- [Project Structure](#project-structure)
- [License](#license)

---

## Overview

SIRI-AI is a unified digital platform that addresses three operational needs of JTM:

1. **Modul 1 — Studio Video Kemerdekaan AI**: AI-assisted (GLM-5.2) concept generation, script writing, and storyboard builder for Merdeka (Independence Day) video content.
2. **Modul 2 — Dashboard Operasi**: Real-time operations dashboard with Kanban work planning, meeting scheduler, KPI tracker, and bulletin board.
3. **Modul 3 — e-Pembelajaran Drone for Beginner**: A 6-module / 18-lesson interactive course with quizzes, auto-issued certificates, and a leaderboard.

---

## Features

### Modul 1: Video Kemerdekaan AI Studio
- ✨ AI concept generation (GLM-5.2) from theme input
- 📝 AI script generation (Bahasa Malaysia / English)
- 🎬 Drag-and-drop storyboard builder with per-scene AI visual prompts
- 📁 Media asset management
- ✅ Multi-stage approval workflow (Draft → Review → Approved → Ready for Production)
- 📦 JSON export of production specification package

### Modul 2: Dashboard Operasi
- 📊 4 live stat cards (Active Tasks, This Week's Meetings, Overdue Key Tasks, New Announcements)
- 🗂️ 4-column Kanban board with drag-and-drop status updates (`@dnd-kit`)
- 📅 Meeting scheduler with participants, agenda, action items, and AI meeting-summary
- 🎯 Key Tasks (KPI) tracker with color-coded progress bars
- 📢 Bulletin board with category filter, pinning, and archive

### Modul 3: e-Pembelajaran Drone for Beginner
- 📚 6 modules / 18 lessons / 12 quizzes (real course content in Bahasa Malaysia)
- 🎥 Lesson player supporting text, video, and PDF content types
- ✅ Interactive quizzes with immediate feedback and explanations
- 🏆 Auto-issued digital certificates (PDF-printable) on course completion (≥70% score)
- 🥇 Leaderboard with gold/silver/bronze rankings
- 📈 Per-user progress tracking

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) + TypeScript 5 |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York) + Glassmorphism design system |
| **Database** | PostgreSQL via Supabase (Prisma ORM) |
| **Auth** | NextAuth.js v4 (JWT, 8h sessions, role-based access control) |
| **AI** | Z.AI GLM-5.2 (via `z-ai-web-dev-sdk`, server-side only) |
| **State** | TanStack Query (server), Zustand (client) |
| **Deployment** | Vercel (native Next.js support) |
| **Icons** | lucide-react |
| **Fonts** | Poppins (display), Inter (body) |

---

## Demo Accounts

All accounts use the same password: **`Siri@2026`**

| Role | Email | Module Access |
|---|---|---|
| Pentadbir Sistem (Admin) | `admin@jtm.gov.my` | All modules + admin |
| Pengurus (Manager) | `manager1@jtm.gov.my` | Dashboard + approvals + e-Learning |
| Pegawai (Officer) | `officer1@jtm.gov.my` | Dashboard + e-Learning |
| Krew Kreatif (Creative) | `creative1@jtm.gov.my` | Video Studio + Dashboard + e-Learning |
| Pelatih (Trainee) | `trainee1@jtm.gov.my` | e-Learning only |

---

## Local Development

### Prerequisites
- Node.js 20+ (or [Bun](https://bun.sh) 1.3+)
- A Supabase project (free tier works) — see [Database Setup](#database-setup-supabase)
- A Z.AI API key (for AI features) — get one at [z.ai](https://z.ai)

### Install & Run

```bash
# 1. Clone the repo
git clone https://github.com/khairulanuar-collab/Sistem-Integrasi-Rekabentuk-Inovasi.git
cd Sistem-Integrasi-Rekabentuk-Inovasi

# 2. Install dependencies
bun install
# or: npm install

# 3. Copy env template and fill in your values
cp .env.example .env
# Edit .env with your Supabase URL, database URL, NextAuth secret, Z.AI key

# 4. Push database schema to Supabase & seed dummy data
bun run db:push
bun run db:seed

# 5. Start the dev server
bun run dev
# Open http://localhost:3000
```

---

## Database Setup (Supabase)

This project uses **Supabase Postgres** as the backend (per PRD §4.1, §9).

### Step 1: Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a region close to your users (e.g. `ap-northeast-1` Tokyo for Asia)
3. Set a strong database password — save it somewhere safe

### Step 2: Get your connection string
1. In your Supabase dashboard: **Project Settings → Database → Connection String**
2. Use the **Connection Pooler** URL (port `6543`) — it's IPv4-compatible and works in serverless environments
3. URL-encoded your password if it contains special characters (`@` → `%40`)

Format:
```
postgresql://postgres.[project-ref]:[url-encoded-password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&prepared_statements=false&connection_limit=1
```

### Step 3: Push schema & seed data
```bash
# Generate Prisma client
bun run db:generate

# Create all 23 tables in your Supabase project
bun run db:push

# Seed dummy data (14 users, 25 tasks, 8 meetings, 6 KPIs, 10 bulletins,
# 2 video projects, 1 course with 6 modules/18 lessons/12 quizzes, 9 enrollments,
# certificates, audit logs)
bun run db:seed
```

### Step 4 (Recommended): Enable Row Level Security
Per PRD §9.2 & §12, enable RLS in your Supabase dashboard for defense-in-depth:
1. Go to **Database → Tables**
2. Enable RLS on each table
3. Add policies appropriate to your role model

---

## Deployment (Vercel)

This project is configured for Vercel deployment — the natural platform for Next.js apps.

### Step 1: Push to GitHub
```bash
git remote add origin https://github.com/khairulanuar-collab/Sistem-Integrasi-Rekabentuk-Inovasi.git
git push -u origin main
```

### Step 2: Import to Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Connect your GitHub account and select this repository: `Sistem-Integrasi-Rekabentuk-Inovasi`
3. Vercel auto-detects Next.js — settings come from `vercel.json`:
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `bun run build` (or `npm run build`)
   - **Output Directory**: (auto-detected by Next.js preset)
   - **Install Command**: `bun install` (or `npm install`)

### Step 3: Configure Environment Variables
In Vercel project settings → **Environment Variables**, add all 7 variables below. **Important**: Set them for all environments (Production, Preview, Development).

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Supabase pooler connection string (same as `.env`) |
| `NEXTAUTH_URL` | `https://your-project.vercel.app` (replace with your Vercel URL after first deploy) |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `ZAI_API_KEY` | Your Z.AI API key (get one at [z.ai](https://z.ai)) |
| `SUPABASE_URL` | `https://[project-ref].supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase publishable/anon key |
| `SUPABASE_PROJECT_REF` | Your Supabase project ref |

> ⚠️ **Never commit `.env` to Git.** All secrets must be set in Vercel's environment variables UI.

### Step 4: Deploy
Click **"Deploy"**. Vercel will:
1. Run `bun install` (or `npm install`) — auto-runs `postinstall: prisma generate`
2. Run `bun run build` (builds Next.js with native Vercel optimization)
3. Deploy to global edge network with HTTPS (auto-renewed SSL)

Build time: ~2-4 minutes. You'll get a live URL like `https://siri-ai-jtm.vercel.app`.

### Step 5: Update NEXTAUTH_URL
After the first deploy:
1. Copy your Vercel URL (e.g. `https://siri-ai-jtm-abc123.vercel.app`)
2. Update the `NEXTAUTH_URL` environment variable in Vercel to match
3. Trigger a redeploy (Deployments → ⋮ → Redeploy)

### Branch-based Environments (per PRD §13.1)
Vercel automatically creates preview deployments for every branch and PR:
- `main` → Production deployment
- `staging` → Preview deployment (for UAT per PRD §13.1)
- Pull requests → ephemeral preview deployments

### Custom Domain (per PRD §13.2)
1. Vercel → Project → **Settings → Domains**
2. Add your custom domain (e.g. `siri-ai.jtm.gov.my`)
3. Update your DNS provider with the CNAME or A record Vercel provides
4. SSL certificate is auto-issued and renewed by Vercel

---

## Security

Per PRD §12, this system implements multiple layers of security:

- **Authentication**: NextAuth.js with JWT sessions (8-hour expiry, refresh tokens)
- **Authorization (RBAC)**: Role-based access control on every API route via `requirePermission(entity, action)` helper. Roles: ADMIN, MANAGER, OFFICER, CREATIVE, TRAINEE, VISITOR.
- **Input Validation**: Zod schemas on every API request body
- **Audit Logging**: Every write/delete/approve action recorded in `AuditLog` table (login, task.create, video.approve, ai.generate, certificate.issue, etc.)
- **AI Rate Limiting**: 10 GLM calls/minute/user (token-bucket, returns HTTP 429 when exceeded)
- **Secrets Management**: API keys (Z.AI, NextAuth secret, Supabase service role) stored as environment variables — never exposed to client-side code
- **HTTPS/TLS**: Enforced by Vercel (HSTS header set in `vercel.json`)
- **Security Headers**: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` (configured in `vercel.json`)
- **PDPA Compliance**: Per Akta Perlindungan Data Peribadi Malaysia — only necessary user data is collected, audit trail maintained for accountability

---

## Project Structure

```
Sistem-Integrasi-Rekabentuk-Inovasi/
├── prisma/
│   ├── schema.prisma          # Database schema (23 models, PostgreSQL)
│   └── seed.ts                # Seed script with realistic dummy data
├── src/
│   ├── app/
│   │   ├── api/               # 32 API route files (auth, CRUD, AI generate)
│   │   ├── page.tsx           # Main entry — auth gate + module switcher
│   │   ├── layout.tsx         # Root layout (Poppins/Inter fonts, providers)
│   │   └── globals.css        # Glassmorphism design system
│   ├── components/
│   │   ├── glass/             # Reusable glass UI (GlassCard, StatCard, Navbar, Footer, Login)
│   │   ├── modules/           # 3 main modules (dashboard, video-studio, elearning)
│   │   ├── ui/                # shadcn/ui component library
│   │   └── providers.tsx      # SessionProvider + QueryClientProvider
│   ├── lib/
│   │   ├── auth.ts            # NextAuth config (Credentials provider, JWT, RBAC)
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── security.ts        # RBAC helpers, rate limiting, password hashing
│   │   ├── api/helpers.ts     # API helpers (requireAuth, requirePermission, validateBody, audit)
│   │   ├── format.ts          # Bahasa Malaysia date/time/label formatters
│   │   ├── store.ts           # Zustand store + TypeScript types
│   │   └── utils.ts           # cn() helper
│   └── hooks/                 # use-toast, use-mobile
├── public/                    # Static assets
├── .env.example               # Environment variables template
├── vercel.json                # Vercel deployment config (security headers, build)
├── next.config.ts             # Next.js config
├── package.json               # Scripts + dependencies
└── README.md                  # This file
```

---

## License

**Terhad — Untuk Kegunaan Dalaman JTM & Pasukan Pembangunan**

This project is classified as Restricted — for internal use by Jabatan Tenaga Manusia Malaysia and the authorized development team only. Per PDPA Malaysia and JTM IT governance policies.

---

## 📞 Support

For technical inquiries, contact the **Unit ICT JTM** development team.

**Document Version**: 1.0 | **Status**: Draf untuk Semakan | **Date**: 14 Julai 2026

Tech Stack: Z.AI (GLM-5.2) · Supabase · Vercel · Glassmorphism UI/UX
