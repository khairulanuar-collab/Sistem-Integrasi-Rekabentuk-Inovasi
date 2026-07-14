# Task 5-c — Video AI Studio UI

## Files created
- `/home/z/my-project/src/lib/format.ts` — shared formatting helpers (BM locale): formatDate, formatDateTime, relativeTime, initials, formatFileSize(bytes), formatDuration(seconds → "MM:SS")
- `/home/z/my-project/src/components/modules/video-studio.tsx` — `VideoStudioModule` default export, full Module 1 UI

## Architecture
- Single self-contained client component (`"use client"`)
- Internal `view` state ("list" | "detail") — no router used
- RBAC: read gate at top (ADMIN/MANAGER/CREATIVE only); finer gating inside via `canPerform`
- TanStack Query keys: `["video-projects", status]`, `["video-project", id]`
- All mutations invalidate relevant query keys
- Toast feedback via `sonner` for every user action

## Key implementation notes
- List endpoint returns `{ projects: [...] }` — handled in queryFn
- Single GET returns `{ project: ... }` — handled in detail queryFn
- AI generate endpoint returns `{ content, module, tokensUsed, model }` — token count shown in toast
- Export endpoint returns raw package (no wrapping key) — Blob download with safe filename
- @dnd-kit/sortable used for scene drag-to-reorder; optimistic update + invalidate on success
- All dialogs reset form state via `handleOpenChange` pattern (not useEffect) to satisfy `react-hooks/set-state-in-effect` lint rule
- AI buttons: gradient gold→amber→teal + Sparkles icon + "GLM-5.2" badge

## Verification
- `bun run lint` — zero errors
- dev.log shows no compile errors

## Dependencies consumed (already installed)
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- @tanstack/react-query, sonner, lucide-react, next-auth
- shadcn/ui: button, input, label, textarea, select, badge, dialog, alert-dialog
