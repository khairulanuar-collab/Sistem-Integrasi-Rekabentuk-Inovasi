/**
 * SIRI-AI JTM — Format helpers (Bahasa Malaysia locale)
 * Used across dashboard, e-learning, and reporting modules.
 */

const MS_MONTHS = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember",
];

const MS_MONTHS_SHORT = [
  "Jan", "Feb", "Mac", "Apr", "Mei", "Jun",
  "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis",
];

const MS_DAYS = [
  "Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu",
];

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return null;
  return d;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "12 Jan 2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${d.getDate()} ${MS_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "12 Januari 2026" (long month name) */
export function formatDateLong(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${d.getDate()} ${MS_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Isnin, 12 Januari 2026" */
export function formatDateFull(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${MS_DAYS[d.getDay()]}, ${d.getDate()} ${MS_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "12 Jan 2026, 14:30" */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${formatDate(d)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "14:30" */
export function formatTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "10 min" / "1 jam 5 min" */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} jam` : `${h} jam ${m} min`;
}

/** Format file size in bytes → "240 KB", "1.2 MB", "86 MB" */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIdx = 0;
  while (size >= 1024 && unitIdx < units.length - 1) {
    size /= 1024;
    unitIdx++;
  }
  return `${size >= 10 || unitIdx === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIdx]}`;
}

/** Format scene/video duration in SECONDS → "MM:SS" (used by video-studio). */
export function formatDurationSec(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${pad2(m)}:${pad2(s)}`;
}

/** Relative "baru saja", "5 minit lalu", "2 jam lalu", fallback to formatDate */
export function formatRelative(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  const now = Date.now();
  const diff = now - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "baru saja";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} hari lalu`;
  return formatDate(d);
}

/** Alias for formatRelative (used by video-studio module). */
export const relativeTime = formatRelative;

/** Initials from name, e.g. "Ahmad Rahman" -> "AR" */
export function initials(name: string | null | undefined): string {
  if (!name) return "U";
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ============================================================
// PRD §7 — Dashboard label helpers (Bahasa Malaysia)
// ============================================================

/** Task priority label in BM. */
export function priorityLabel(p?: string | null): string {
  switch (p) {
    case "high": return "Tinggi";
    case "medium": return "Sederhana";
    case "low": return "Rendah";
    default: return "Sederhana";
  }
}

/** Task status label in BM (todo/in_progress/review/done). */
export function statusLabel(s?: string | null): string {
  switch (s) {
    case "todo": return "Belum Mula";
    case "in_progress": return "Dalam Tindakan";
    case "review": return "Semakan";
    case "done": return "Selesai";
    default: return s ?? "Belum Mula";
  }
}

/** Key-task (KPI) status label in BM. */
export function keyTaskStatusLabel(s?: string | null): string {
  switch (s) {
    case "on_track": return "On Track";
    case "at_risk": return "Berisiko";
    case "delayed": return "Tertangguh";
    case "completed": return "Selesai";
    default: return s ?? "On Track";
  }
}

/**
 * Due-date relative phrasing in BM:
 *  - future: "3 hari lagi", "Esok", "Hari ini"
 *  - past:   "Tertunggak 2 hari", "Tertunggak hari ini"
 *  Returns empty string when no date.
 */
export function dueRelative(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / dayMs);
  if (diffDays === 0) return "Hari ini";
  if (diffDays === 1) return "Esok";
  if (diffDays === -1) return "Tertunggak 1 hari";
  if (diffDays > 1) return `${diffDays} hari lagi`;
  return `Tertunggak ${Math.abs(diffDays)} hari`;
}

/** Tailwind classes for bulletin category badge (teal/gold/navy/red palette). */
export function categoryColor(c?: string | null): string {
  switch (c) {
    case "Pengumuman Rasmi":
      return "bg-gold/22 text-gold border-gold/40";
    case "Acara/Aktiviti":
      return "bg-teal/22 text-teal-soft border-teal/40";
    case "Notis Pentadbiran":
      return "bg-navy-soft/40 text-blue-100 border-white/15";
    case "Perayaan/Kemerdekaan":
      return "bg-red-500/22 text-red-300 border-red-500/40";
    default:
      return "bg-white/10 text-foreground border-white/20";
  }
}

/** Color-coded progress bar class based on percentage. */
export function progressColor(pct: number): string {
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 40) return "bg-gold";
  return "bg-red-500";
}

/** Convert ISO date to "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
export function toDateTimeLocal(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Convert ISO date to "YYYY-MM-DD" for <input type="date">. */
export function toDateInput(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
