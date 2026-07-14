"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  GraduationCap,
  Plane,
  BookOpen,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Award,
  Trophy,
  Medal,
  Lock,
  Clock,
  ArrowLeft,
  ChevronRight,
  Download,
  Sparkles,
  FileText,
  CirclePlay,
  Loader2,
  ShieldCheck,
  ListChecks,
  BarChart3,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateLong, formatDuration } from "@/lib/format";
import type {
  CourseT,
  CourseModuleT,
  LessonT,
  QuizT,
  EnrollmentT,
} from "@/lib/store";

// ============================================================
// Types — shaped to match API responses from Task 5-a
// ============================================================

type View = "catalog" | "player" | "certificate";

interface CourseListItem {
  id: string;
  title: string;
  description?: string | null;
  level: string;
  thumbnailUrl?: string | null;
  moduleCount: number;
  totalEnrolled: number;
  myEnrollment: {
    id: string;
    status: string;
    progressPct: number;
    score?: number | null;
    completedAt?: string | null;
  } | null;
}

interface FullCourseResponse {
  course: CourseT & {
    modules: (CourseModuleT & {
      lessons: LessonT[];
      quizzes: QuizT[];
    })[];
  };
  myEnrollment: {
    id: string;
    status: string;
    progressPct: number;
    score?: number | null;
    enrolledAt: string;
    completedAt?: string | null;
  } | null;
}

interface LeaderboardEntry {
  rank: number;
  enrollmentId: string;
  userId: string;
  name: string;
  unit?: string | null;
  avatarUrl?: string | null;
  score: number;
  completedAt?: string | null;
}

interface CertificateData {
  certificate: {
    id: string;
    certificateNo: string;
    issuedAt: string;
    score: number;
    certificateUrl?: string | null;
  };
  user: {
    id: string;
    name: string;
    unit?: string | null;
    position?: string | null;
    email: string;
  };
  course: {
    id: string;
    title: string;
    level: string;
  };
  enrollment: {
    id: string;
    completedAt?: string | null;
    status: string;
  };
}

interface AttemptResult {
  selectedAnswer: number;
  isCorrect: boolean;
  correctAnswer: number;
  explanation?: string | null;
  isPending?: boolean;
}

// ============================================================
// Helpers
// ============================================================

function parseOptions(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.map(String);
    return [];
  } catch {
    return [];
  }
}

function flattenLessons(course: FullCourseResponse["course"]): Array<LessonT & { module: CourseModuleT }> {
  const out: Array<LessonT & { module: CourseModuleT }> = [];
  for (const m of course.modules ?? []) {
    for (const l of m.lessons ?? []) {
      out.push({ ...l, module: m });
    }
  }
  return out;
}

function contentTypeMeta(contentType: string): { label: string; icon: typeof BookOpen; tone: string } {
  switch (contentType) {
    case "video":
      return { label: "Video", icon: CirclePlay, tone: "bg-teal/25 text-teal-soft border-teal/40" };
    case "pdf":
      return { label: "PDF", icon: FileText, tone: "bg-gold/25 text-gold border-gold/40" };
    case "text":
    default:
      return { label: "Teks", icon: BookOpen, tone: "bg-navy-soft/40 text-slate-200 border-white/20" };
  }
}

function levelLabel(level: string): string {
  switch (level?.toLowerCase()) {
    case "beginner":
    case "asas":
      return "Asas";
    case "intermediate":
    case "pertengahan":
      return "Pertengahan";
    case "advanced":
    case "lanjutan":
      return "Lanjutan";
    default:
      return level || "Asas";
  }
}

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

// ============================================================
// Main component
// ============================================================

export default function ELearningModule() {
  const { data: session, status } = useSession();
  const qc = useQueryClient();

  const role = session?.user?.role as string | undefined;
  const userId = session?.user?.id as string | undefined;

  const [view, setView] = useState<View>("catalog");
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [visitedLessons, setVisitedLessons] = useState<Set<string>>(new Set());
  const [quizAttempts, setQuizAttempts] = useState<Record<string, AttemptResult>>({});

  // === Queries ===
  const coursesQ = useQuery<{ courses: CourseListItem[] }>({
    queryKey: ["courses"],
    queryFn: async () => {
      const r = await fetch("/api/courses", { credentials: "include" });
      if (!r.ok) throw new Error("Gagal memuatkan kursus");
      return r.json();
    },
    enabled: status === "authenticated",
  });

  const courseId = coursesQ.data?.courses?.[0]?.id;

  const courseQ = useQuery<FullCourseResponse>({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const r = await fetch(`/api/courses/${courseId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Gagal memuatkan kursus");
      return r.json();
    },
    enabled: !!courseId && status === "authenticated",
  });

  const leaderboardQ = useQuery<{ courseTitle: string; leaderboard: LeaderboardEntry[] }>({
    queryKey: ["leaderboard", courseId],
    queryFn: async () => {
      const r = await fetch(`/api/courses/${courseId}/leaderboard`, { credentials: "include" });
      if (!r.ok) throw new Error("Gagal memuatkan papan pendahulu");
      return r.json();
    },
    enabled: !!courseId && status === "authenticated",
  });

  const course = courseQ.data?.course;
  const myEnrollment = courseQ.data?.myEnrollment ?? null;
  const flatLessons = useMemo(() => (course ? flattenLessons(course) : []), [course]);

  // === Persistence (per course) ===
  const storageKey = courseId ? `siri-ai:elearning:${courseId}` : null;

  // Track which storageKey we've hydrated from. We hydrate during render
  // (the official "adjusting state when a prop changes" pattern from React docs)
  // so we don't trigger the set-state-in-effect rule.
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  if (storageKey && storageKey !== hydratedKey) {
    const data = loadJSON<{ visited: string[]; attempts: Record<string, AttemptResult> }>(storageKey, {
      visited: [],
      attempts: {},
    });
    setVisitedLessons(new Set(data.visited));
    setQuizAttempts(data.attempts);
    setHydratedKey(storageKey);
  }

  // Persist on every change (after hydration — saving the just-loaded value is a no-op).
  useEffect(() => {
    if (!storageKey || hydratedKey !== storageKey) return;
    saveJSON(storageKey, {
      visited: Array.from(visitedLessons),
      attempts: quizAttempts,
    });
  }, [storageKey, hydratedKey, visitedLessons, quizAttempts]);

  // === Mutations ===
  const enrollMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/courses/${courseId}/enroll`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) {
        const e = await r.json().catch(() => null);
        throw new Error(e?.error || "Gagal mendaftar kursus");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Pendaftaran berjaya!", {
        description: "Anda kini boleh mula belajar. Selamat maju jaya!",
      });
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      qc.invalidateQueries({ queryKey: ["enrollments", "mine"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (err: Error) => toast.error("Pendaftaran gagal", { description: err.message }),
  });

  const attemptMut = useMutation({
    mutationFn: async ({ quizId, selectedAnswer }: { quizId: string; selectedAnswer: number }) => {
      const r = await fetch(`/api/quizzes/${quizId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ selectedAnswer, enrollmentId: myEnrollment?.id }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => null);
        throw new Error(e?.error || "Gagal menghantar jawapan");
      }
      return r.json();
    },
    onMutate: ({ quizId, selectedAnswer }) => {
      // optimistic local cache so UI locks immediately; isPending hides the
      // correct/wrong feedback until the server response settles.
      setQuizAttempts((prev) => ({
        ...prev,
        [quizId]: {
          selectedAnswer,
          isCorrect: false,
          correctAnswer: -1,
          explanation: null,
          isPending: true,
        },
      }));
    },
    onSuccess: (data, vars) => {
      const result: AttemptResult = {
        selectedAnswer: vars.selectedAnswer,
        isCorrect: data.isCorrect,
        correctAnswer: data.correctAnswer,
        explanation: data.explanation ?? null,
        isPending: false,
      };
      setQuizAttempts((prev) => ({ ...prev, [vars.quizId]: result }));

      if (data.isCorrect) {
        toast.success("Jawapan betul!", {
          description: "Kerja bagus. Teruskan ke soalan seterusnya.",
          icon: <CheckCircle2 className="size-4 text-emerald-400" />,
        });
      } else {
        toast.error("Jawapan kurang tepat", {
          description: "Baca penjelasan di bawah untuk memahami jawapan sebenar.",
          icon: <XCircle className="size-4 text-red-400" />,
        });
      }

      if (data.certificate) {
        toast.success("Tahniah! Sijil diterbitkan 🎉", {
          description: `No. Sijil: ${data.certificate.certificateNo} · Skor: ${data.certificate.score}%`,
          duration: 6000,
        });
        qc.invalidateQueries({ queryKey: ["course", courseId] });
        qc.invalidateQueries({ queryKey: ["enrollments", "mine"] });
        qc.invalidateQueries({ queryKey: ["leaderboard", courseId] });
      } else {
        // always refresh enrollment to reflect new progress
        qc.invalidateQueries({ queryKey: ["course", courseId] });
      }
    },
    onError: (err: Error, vars) => {
      // rollback optimistic entry
      setQuizAttempts((prev) => {
        const next = { ...prev };
        delete next[vars.quizId];
        return next;
      });
      toast.error("Gagal menghantar jawapan", { description: err.message });
    },
  });

  // === Navigation ===
  const openPlayer = useCallback(
    (lessonId?: string) => {
      if (!course || flatLessons.length === 0) return;
      let target = lessonId;
      if (!target) {
        const firstIncomplete = flatLessons.find((l) => !visitedLessons.has(l.id));
        target = (firstIncomplete ?? flatLessons[0]).id;
      }
      setCurrentLessonId(target);
      setVisitedLessons((prev) => new Set([...prev, target]));
      setView("player");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [course, flatLessons, visitedLessons]
  );

  const goToNextLesson = useCallback(() => {
    if (!course || !currentLessonId) return;
    const idx = flatLessons.findIndex((l) => l.id === currentLessonId);
    const next = flatLessons[idx + 1];
    if (next) {
      setCurrentLessonId(next.id);
      setVisitedLessons((prev) => new Set([...prev, next.id]));
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [course, currentLessonId, flatLessons]);

  const goToLesson = useCallback(
    (lessonId: string) => {
      setCurrentLessonId(lessonId);
      setVisitedLessons((prev) => new Set([...prev, lessonId]));
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    []
  );

  const handleEnroll = useCallback(() => {
    enrollMut.mutate();
  }, [enrollMut]);

  // Watch for enroll completion — auto-open player
  useEffect(() => {
    if (myEnrollment && view === "catalog" && enrollMut.isSuccess) {
      // small delay so the course refetch completes
      const t = setTimeout(() => openPlayer(), 250);
      return () => clearTimeout(t);
    }
  }, [myEnrollment, view, enrollMut.isSuccess, openPlayer]);

  // === RBAC gate ===
  if (status === "loading") return <LoadingState />;
  if (!session) return <LoadingState />;
  if (role === "VISITOR") return <AccessDenied />;

  // === Certificate view ===
  if (view === "certificate" && myEnrollment) {
    return (
      <CertificateView
        enrollmentId={myEnrollment.id}
        onBack={() => setView("catalog")}
        onViewPlayer={() => setView("player")}
      />
    );
  }

  // === Player view ===
  if (view === "player" && course && currentLessonId) {
    const currentLesson = flatLessons.find((l) => l.id === currentLessonId);
    if (currentLesson) {
      return (
        <PlayerView
          course={course}
          flatLessons={flatLessons}
          currentLesson={currentLesson}
          visitedLessons={visitedLessons}
          quizAttempts={quizAttempts}
          myEnrollment={myEnrollment}
          onGoToLesson={goToLesson}
          onNextLesson={goToNextLesson}
          onBack={() => setView("catalog")}
          onAttempt={(quizId, selectedAnswer) => attemptMut.mutate({ quizId, selectedAnswer })}
          attempting={attemptMut.isPending}
          onViewCertificate={() => setView("certificate")}
        />
      );
    }
  }

  // === Catalog view (default) ===
  return (
    <CatalogView
      coursesQ={coursesQ}
      courseQ={courseQ}
      leaderboardQ={leaderboardQ}
      myEnrollment={myEnrollment}
      userId={userId}
      onEnroll={handleEnroll}
      onContinue={() => openPlayer()}
      onViewCertificate={() => setView("certificate")}
      enrolling={enrollMut.isPending}
    />
  );
}

// ============================================================
// Loading + access states
// ============================================================

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="glass p-8 flex flex-col items-center gap-4">
        <Loader2 className="size-8 animate-spin text-teal-soft" />
        <div className="text-sm text-muted-foreground">Memuatkan modul e-pembelajaran…</div>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <div className="glass-strong p-8 text-center animate-glass-in">
        <div className="size-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
          <Lock className="size-8 text-red-300" />
        </div>
        <h2 className="font-display text-xl font-bold text-foreground mb-2">Akses Dinafikan</h2>
        <p className="text-sm text-muted-foreground">
          Modul e-Pembelajaran hanya tersedia untuk kakitangan dan pelatih JTM yang berdaftar.
          Akaun pelawat tidak dibenarkan mengakses kursus ini.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// View 1 — Catalog
// ============================================================

interface CatalogViewProps {
  coursesQ: ReturnType<typeof useQuery<{ courses: CourseListItem[] }>>;
  courseQ: ReturnType<typeof useQuery<FullCourseResponse>>;
  leaderboardQ: ReturnType<typeof useQuery<{ courseTitle: string; leaderboard: LeaderboardEntry[] }>>;
  myEnrollment: FullCourseResponse["myEnrollment"];
  userId?: string;
  onEnroll: () => void;
  onContinue: () => void;
  onViewCertificate: () => void;
  enrolling: boolean;
}

function CatalogView({
  coursesQ,
  courseQ,
  leaderboardQ,
  myEnrollment,
  userId,
  onEnroll,
  onContinue,
  onViewCertificate,
  enrolling,
}: CatalogViewProps) {
  const course = coursesQ.data?.courses?.[0];
  const fullCourse = courseQ.data?.course;
  const isEnrolled = !!myEnrollment;
  const isCompleted = myEnrollment?.status === "completed";

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-6 sm:py-8 animate-glass-in">
      {/* Header */}
      <header className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="size-9 rounded-xl bg-teal/25 border border-teal/45 flex items-center justify-center">
            <GraduationCap className="size-5 text-teal-soft" />
          </div>
          <Badge className="bg-teal/20 text-teal-soft border-teal/40">Modul 3</Badge>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-tight">
          Modul e-Pembelajaran ·{" "}
          <span className="text-gradient-teal">Drone for Beginner</span>
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1.5 max-w-3xl">
          Kursus asas pengendalian dron (UAV) untuk kakitangan dan pelatih JTM. Selesaikan semua
          pelajaran dan kuiz dengan skor ≥ 70% untuk menerima sijil penyempurnaan.
        </p>
      </header>

      {/* Loading skeletons */}
      {coursesQ.isLoading && (
        <div className="grid lg:grid-cols-3 gap-5">
          <Skeleton className="lg:col-span-2 h-[460px] rounded-2xl bg-white/8" />
          <Skeleton className="h-[460px] rounded-2xl bg-white/8" />
        </div>
      )}

      {course && (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Featured course card */}
          <div className="lg:col-span-2">
            <FeaturedCourseCard
              course={course}
              fullCourse={fullCourse}
              loading={courseQ.isLoading}
              isEnrolled={isEnrolled}
              isCompleted={isCompleted}
              myEnrollment={myEnrollment}
              onEnroll={onEnroll}
              onContinue={onContinue}
              onViewCertificate={onViewCertificate}
              enrolling={enrolling}
            />
          </div>

          {/* Leaderboard */}
          <div>
            <LeaderboardCard query={leaderboardQ} currentUserId={userId} />
          </div>
        </div>
      )}

      {coursesQ.isError && (
        <div className="glass p-6 text-center text-sm text-red-300">
          Gagal memuatkan kursus. Sila muat semula halaman.
        </div>
      )}
    </div>
  );
}

interface FeaturedCourseCardProps {
  course: CourseListItem;
  fullCourse?: CourseT;
  loading: boolean;
  isEnrolled: boolean;
  isCompleted: boolean;
  myEnrollment: FullCourseResponse["myEnrollment"];
  onEnroll: () => void;
  onContinue: () => void;
  onViewCertificate: () => void;
  enrolling: boolean;
}

function FeaturedCourseCard({
  course,
  fullCourse,
  loading,
  isEnrolled,
  isCompleted,
  myEnrollment,
  onEnroll,
  onContinue,
  onViewCertificate,
  enrolling,
}: FeaturedCourseCardProps) {
  // Count lessons + quizzes from full course if available
  let lessonCount = 0;
  let quizCount = 0;
  let moduleCount = course.moduleCount;
  if (fullCourse?.modules) {
    for (const m of fullCourse.modules) {
      lessonCount += m.lessons?.length ?? 0;
      quizCount += m.quizzes?.length ?? 0;
    }
  } else {
    // Fallback to PRD defaults if full course still loading
    lessonCount = 18;
    quizCount = 12;
  }

  const totalEnrolled = course.totalEnrolled ?? 0;

  return (
    <div className="glass-strong overflow-hidden animate-glass-in">
      {/* Thumbnail — gradient with drone icon (no real image) */}
      <div className="relative h-44 sm:h-56 bg-gradient-to-br from-teal via-navy-soft to-navy overflow-hidden">
        {/* decorative blobs */}
        <div className="absolute inset-0 opacity-50 pointer-events-none">
          <div className="absolute -top-10 -right-10 size-48 rounded-full bg-gold/30 blur-3xl" />
          <div className="absolute -bottom-16 -left-12 size-56 rounded-full bg-teal-soft/30 blur-3xl" />
        </div>
        {/* grid pattern */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Drone icon centerpiece */}
        <div className="relative h-full flex items-center justify-center">
          <div className="size-20 sm:size-24 rounded-2xl bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl">
            <Plane className="size-10 sm:size-12 text-white rotate-12" />
          </div>
        </div>
        {/* Level badge */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
          <Badge className="bg-gold/30 text-gold border-gold/50 backdrop-blur-sm">
            <Sparkles className="size-3" />
            {levelLabel(course.level)}
          </Badge>
        </div>
        {/* Course title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 bg-gradient-to-t from-navy/85 via-navy/40 to-transparent">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">
            {course.title}
          </h2>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6">
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {course.description ?? "Kursus asas pengendalian dron UAV untuk pemula."}
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
          <StatPill icon={BookOpen} label="Modul" value={moduleCount || 6} />
          <StatPill icon={ListChecks} label="Pelajaran" value={lessonCount} />
          <StatPill icon={Award} label="Soalan Kuiz" value={quizCount} />
          <StatPill icon={Users} label="Pendaftar" value={totalEnrolled} />
        </div>

        {/* Enrollment / progress card */}
        {loading ? (
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
            <Skeleton className="h-4 w-32 bg-white/10" />
            <Skeleton className="h-2 w-full bg-white/10" />
          </div>
        ) : isEnrolled ? (
          <EnrollmentProgressCard
            myEnrollment={myEnrollment as NonNullable<FullCourseResponse["myEnrollment"]>}
            isCompleted={isCompleted}
            onContinue={onContinue}
            onViewCertificate={onViewCertificate}
          />
        ) : (
          <div className="rounded-xl bg-gradient-to-r from-teal/15 to-gold/10 border border-teal/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-display font-semibold text-foreground text-sm">
                Belum mendaftar lagi?
              </div>
              <div className="text-xs text-muted-foreground">
                Daftar percuma dan mula belajar dalam masa beberapa saat.
              </div>
            </div>
            <Button
              onClick={onEnroll}
              disabled={enrolling}
              className="bg-gradient-to-r from-teal to-teal-soft hover:from-teal-soft hover:to-teal text-white shadow-lg shadow-teal/30"
            >
              {enrolling ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Mendaftar…
                </>
              ) : (
                <>
                  <GraduationCap className="size-4" />
                  Daftar Sekarang
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/12 p-3 flex items-center gap-2.5">
      <div className="size-8 rounded-lg bg-teal/20 border border-teal/35 flex items-center justify-center text-teal-soft shrink-0">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="font-display font-bold text-foreground leading-tight">{value}</div>
        <div className="text-[10px] text-muted-foreground leading-tight uppercase tracking-wide">
          {label}
        </div>
      </div>
    </div>
  );
}

function EnrollmentProgressCard({
  myEnrollment,
  isCompleted,
  onContinue,
  onViewCertificate,
}: {
  myEnrollment: NonNullable<FullCourseResponse["myEnrollment"]>;
  isCompleted: boolean;
  onContinue: () => void;
  onViewCertificate: () => void;
}) {
  const score = myEnrollment.score ?? 0;
  const progress = myEnrollment.progressPct ?? 0;
  return (
    <div className="rounded-xl bg-white/5 border border-white/12 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "size-2.5 rounded-full",
              isCompleted ? "bg-emerald-400" : "bg-teal-soft animate-pulse-soft"
            )}
          />
          <span className="text-xs font-medium text-foreground/85">
            {isCompleted ? "Kursus Selesai" : "Sedang Berjalan"}
          </span>
        </div>
        {isCompleted ? (
          <Badge className="bg-emerald-500/25 text-emerald-300 border-emerald-500/45">
            <CheckCircle2 className="size-3" /> Lulus
          </Badge>
        ) : (
          <Badge className="bg-teal/25 text-teal-soft border-teal/45">In Progress</Badge>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
        <span>Kemajuan</span>
        <span className="font-mono text-foreground/85">{progress}%</span>
      </div>
      <Progress
        value={progress}
        className={cn("h-2", isCompleted && "[&>[data-slot=progress-indicator]]:bg-emerald-400")}
      />

      <div className="flex items-center justify-between gap-3 mt-4">
        <div className="text-xs text-muted-foreground">
          {isCompleted ? (
            <>
              Skor akhir:{" "}
              <span className="font-display font-bold text-gold">{score}%</span> ·{" "}
              {myEnrollment.completedAt && (
                <span>{formatDateLong(myEnrollment.completedAt)}</span>
              )}
            </>
          ) : (
            <>
              {progress < 100
                ? `${100 - progress}% lagi untuk siap`
                : "Menunggu keputusan kuiz…"}
            </>
          )}
        </div>
        <Button
          size="sm"
          onClick={isCompleted ? onViewCertificate : onContinue}
          className={
            isCompleted
              ? "bg-gradient-to-r from-gold to-amber-500 text-navy hover:from-amber-500 hover:to-gold shadow-lg shadow-gold/30"
              : "bg-gradient-to-r from-teal to-teal-soft hover:from-teal-soft hover:to-teal text-white shadow-lg shadow-teal/30"
          }
        >
          {isCompleted ? (
            <>
              <Award className="size-4" /> Lihat Sijil
            </>
          ) : (
            <>
              <PlayCircle className="size-4" /> Teruskan Pembelajaran
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Leaderboard Card
// ============================================================

function LeaderboardCard({
  query,
  currentUserId,
}: {
  query: ReturnType<typeof useQuery<{ courseTitle: string; leaderboard: LeaderboardEntry[] }>>;
  currentUserId?: string;
}) {
  const entries = query.data?.leaderboard ?? [];

  return (
    <div className="glass p-5 sm:p-6 animate-glass-in h-full flex flex-col">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="size-9 rounded-xl bg-gold/20 border border-gold/40 flex items-center justify-center text-gold">
          <Trophy className="size-5" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground">Papan Pendahulu</h3>
          <p className="text-xs text-muted-foreground">Top 10 peserta kursus ini</p>
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg bg-white/8" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-10 px-4">
          <Trophy className="size-10 text-muted-foreground/50 mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">
            Belum ada peserta yang menamatkan kursus ini.
          </div>
          <div className="text-xs text-muted-foreground/70 mt-1">
            Jadilah yang pertama!
          </div>
        </div>
      ) : (
        <ol className="space-y-1.5 max-h-[460px] overflow-y-auto scroll-glass pr-1">
          {entries.map((e) => (
            <LeaderboardRow key={e.enrollmentId} entry={e} isMe={e.userId === currentUserId} />
          ))}
        </ol>
      )}
    </div>
  );
}

function LeaderboardRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const rank = entry.rank;
  const rankMeta =
    rank === 1
      ? { icon: Trophy, tone: "bg-gold/25 text-gold border-gold/50", ring: "ring-gold/30" }
      : rank === 2
      ? { icon: Medal, tone: "bg-slate-300/20 text-slate-200 border-slate-300/40", ring: "ring-slate-300/30" }
      : rank === 3
      ? { icon: Medal, tone: "bg-amber-700/30 text-amber-400 border-amber-700/50", ring: "ring-amber-700/30" }
      : null;

  const RankIcon = rankMeta?.icon;

  return (
    <li
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-xl border transition-all",
        isMe
          ? "bg-teal/15 border-teal/40 ring-1 ring-teal/30"
          : "bg-white/4 border-white/10 hover:bg-white/8"
      )}
    >
      {/* Rank */}
      <div
        className={cn(
          "size-9 rounded-lg border flex items-center justify-center font-display font-bold shrink-0",
          rankMeta ? rankMeta.tone : "bg-white/5 text-muted-foreground border-white/15"
        )}
      >
        {RankIcon ? <RankIcon className="size-4" /> : <span>{rank}</span>}
      </div>

      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground truncate">{entry.name}</span>
          {isMe && (
            <Badge className="bg-teal/25 text-teal-soft border-teal/45 text-[9px] px-1.5 py-0">
              Anda
            </Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{entry.unit || "JTM"}</div>
      </div>

      {/* Score */}
      <div className="text-right shrink-0">
        <div className="font-display font-bold text-foreground text-sm">{entry.score}%</div>
        <div className="text-[10px] text-muted-foreground">skor</div>
      </div>
    </li>
  );
}

// ============================================================
// View 2 — Player
// ============================================================

interface PlayerViewProps {
  course: CourseT & {
    modules: (CourseModuleT & {
      lessons: LessonT[];
      quizzes: QuizT[];
    })[];
  };
  flatLessons: Array<LessonT & { module: CourseModuleT }>;
  currentLesson: LessonT & { module: CourseModuleT };
  visitedLessons: Set<string>;
  quizAttempts: Record<string, AttemptResult>;
  myEnrollment: FullCourseResponse["myEnrollment"];
  onGoToLesson: (lessonId: string) => void;
  onNextLesson: () => void;
  onBack: () => void;
  onAttempt: (quizId: string, selectedAnswer: number) => void;
  attempting: boolean;
  onViewCertificate: () => void;
}

function PlayerView({
  course,
  flatLessons,
  currentLesson,
  visitedLessons,
  quizAttempts,
  myEnrollment,
  onGoToLesson,
  onNextLesson,
  onBack,
  onAttempt,
  attempting,
  onViewCertificate,
}: PlayerViewProps) {
  const currentIdx = flatLessons.findIndex((l) => l.id === currentLesson.id);
  const isLastLesson = currentIdx === flatLessons.length - 1;
  const isLastInModule =
    currentLesson.module.lessons?.[currentLesson.module.lessons.length - 1]?.id ===
    currentLesson.id;
  const moduleQuizzes = currentLesson.module.quizzes ?? [];
  const showQuiz = isLastInModule && moduleQuizzes.length > 0;

  const totalQuizzes = useMemo(
    () => (course.modules ?? []).reduce((s, m) => s + (m.quizzes?.length ?? 0), 0),
    [course]
  );
  // Count only settled attempts (exclude pending optimistic entries)
  const attemptedQuizzes = Object.values(quizAttempts).filter((a) => !a.isPending).length;
  const correctQuizzes = Object.values(quizAttempts).filter((a) => !a.isPending && a.isCorrect).length;
  const allQuizzesAttempted = attemptedQuizzes >= totalQuizzes && totalQuizzes > 0;
  const isCompleted = myEnrollment?.status === "completed";

  // default open all modules so the user can see the full tree
  const moduleIds = useMemo(() => (course.modules ?? []).map((m) => m.id), [course]);
  const allLessonsVisited = flatLessons.length > 0 && flatLessons.every((l) => visitedLessons.has(l.id));

  const contentType = contentTypeMeta(currentLesson.contentType);
  const ContentIcon = contentType.icon;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-5 sm:py-7 animate-glass-in">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-foreground/75 hover:text-foreground hover:bg-white/8"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Katalog
        </Button>
        {myEnrollment && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="size-3.5 text-teal-soft" />
            <span>
              Kemajuan:{" "}
              <span className="font-mono text-foreground/85">
                {myEnrollment.progressPct}%
              </span>
            </span>
            {myEnrollment.score != null && (
              <span className="text-gold">· Skor: {myEnrollment.score}%</span>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="glass p-4 max-h-[70vh] overflow-y-auto scroll-glass">
            <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-white/12">
              <div className="size-8 rounded-lg bg-teal/20 border border-teal/40 flex items-center justify-center text-teal-soft">
                <Plane className="size-4 rotate-12" />
              </div>
              <div className="min-w-0">
                <div className="font-display font-semibold text-sm text-foreground truncate">
                  {course.title}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {course.modules?.length ?? 0} modul · {flatLessons.length} pelajaran
                </div>
              </div>
            </div>

            <Accordion type="multiple" defaultValue={moduleIds} className="space-y-1">
              {(course.modules ?? []).map((m, mi) => {
                const lessons = m.lessons ?? [];
                const quizzes = m.quizzes ?? [];
                const visitedInModule = lessons.filter((l) => visitedLessons.has(l.id)).length;
                const attemptedInModule = quizzes.filter((q) => quizAttempts[q.id]).length;
                const moduleActive = m.id === currentLesson.module.id;

                return (
                  <AccordionItem
                    key={m.id}
                    value={m.id}
                    className="border-b border-white/8 last:border-b-0"
                  >
                    <AccordionTrigger className="hover:no-underline py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 text-left">
                        <div
                          className={cn(
                            "size-7 rounded-lg border flex items-center justify-center text-xs font-display font-bold shrink-0",
                            moduleActive
                              ? "bg-teal/30 text-teal-soft border-teal/50"
                              : "bg-white/5 text-muted-foreground border-white/15"
                          )}
                        >
                          {mi + 1}
                        </div>
                        <div className="min-w-0">
                          <div
                            className={cn(
                              "text-sm font-medium truncate",
                              moduleActive ? "text-foreground" : "text-foreground/80"
                            )}
                          >
                            {m.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                            <span>
                              {visitedInModule}/{lessons.length} pelajaran
                            </span>
                            {quizzes.length > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-gold/80">
                                  Kuiz {attemptedInModule}/{quizzes.length}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-2">
                      <ul className="space-y-0.5 ml-1 border-l border-white/10 pl-2">
                        {lessons.map((l) => {
                          const isCurrent = l.id === currentLesson.id;
                          const isVisited = visitedLessons.has(l.id);
                          const lmeta = contentTypeMeta(l.contentType);
                          const LIcon = lmeta.icon;
                          return (
                            <li key={l.id}>
                              <button
                                onClick={() => onGoToLesson(l.id)}
                                className={cn(
                                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-all",
                                  isCurrent
                                    ? "bg-teal/25 border border-teal/45 text-foreground"
                                    : "border border-transparent hover:bg-white/6 text-foreground/75"
                                )}
                              >
                                <div className="shrink-0">
                                  {isVisited && !isCurrent ? (
                                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                                  ) : isCurrent ? (
                                    <PlayCircle className="size-3.5 text-teal-soft" />
                                  ) : (
                                    <LIcon className="size-3.5 text-muted-foreground/70" />
                                  )}
                                </div>
                                <span className="truncate flex-1">{l.title}</span>
                                <span className="text-[9px] text-muted-foreground shrink-0">
                                  {l.durationMin}m
                                </span>
                              </button>
                            </li>
                          );
                        })}
                        {quizzes.length > 0 && (
                          <li className="pt-1">
                            <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-wide text-gold/80 font-medium">
                              <Award className="size-3" />
                              Kuiz Modul · {quizzes.length} soalan
                            </div>
                          </li>
                        )}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            {/* Sidebar footer — overall progress */}
            <div className="mt-3 pt-3 border-t border-white/12">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>Kuiz keseluruhan</span>
                <span className="font-mono text-foreground/80">
                  {attemptedQuizzes}/{totalQuizzes}
                </span>
              </div>
              <Progress value={totalQuizzes ? (attemptedQuizzes / totalQuizzes) * 100 : 0} className="h-1.5" />
              {correctQuizzes > 0 && (
                <div className="text-[10px] text-muted-foreground mt-1.5">
                  Betul: <span className="text-emerald-400">{correctQuizzes}</span> · Salah:{" "}
                  <span className="text-red-400">{attemptedQuizzes - correctQuizzes}</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0">
          {/* Lesson header */}
          <div className="glass-strong p-5 sm:p-6 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] uppercase tracking-wider text-gold font-medium">
                Modul {currentLesson.module.moduleOrder} · {currentLesson.module.title}
              </span>
            </div>
            <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-foreground leading-tight">
              {currentLesson.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Badge className={contentType.tone + " border"}>
                <ContentIcon className="size-3" />
                {contentType.label}
              </Badge>
              <Badge variant="outline" className="border-white/20 text-foreground/80">
                <Clock className="size-3" />
                {formatDuration(currentLesson.durationMin)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Pelajaran {currentIdx + 1} daripada {flatLessons.length}
              </span>
            </div>
          </div>

          {/* Lesson body */}
          <LessonBody lesson={currentLesson} />

          {/* Action buttons after lesson */}
          <div className="glass p-4 sm:p-5 mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {visitedLessons.has(currentLesson.id) ? (
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <CheckCircle2 className="size-3.5" /> Pelajaran ini ditandai selesai
                </span>
              ) : (
                <span>Tandakan sebagai selesai untuk meneruskan</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  // mark visited in case user hasn't
                  onGoToLesson(currentLesson.id)
                }
                className="border-white/20 text-foreground/85 hover:bg-white/8"
              >
                <CheckCircle2 className="size-4 text-emerald-400" />
                Pelajaran Selesai
              </Button>
              {!isLastLesson && (
                <Button
                  size="sm"
                  onClick={onNextLesson}
                  className="bg-gradient-to-r from-teal to-teal-soft hover:from-teal-soft hover:to-teal text-white shadow-lg shadow-teal/30"
                >
                  Pelajaran Seterusnya
                  <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Quiz section — only after the last lesson of a module */}
          {showQuiz && (
            <QuizSection
              module={currentLesson.module}
              quizAttempts={quizAttempts}
              onAttempt={onAttempt}
              attempting={attempting}
            />
          )}

          {/* Final summary / celebration — only after the last lesson of the whole course */}
          {isLastLesson && (
            <FinalSummaryCard
              isCompleted={!!isCompleted}
              allQuizzesAttempted={allQuizzesAttempted}
              attemptedQuizzes={attemptedQuizzes}
              totalQuizzes={totalQuizzes}
              correctQuizzes={correctQuizzes}
              allLessonsVisited={allLessonsVisited}
              score={myEnrollment?.score ?? null}
              course={course}
              quizAttempts={quizAttempts}
              onViewCertificate={onViewCertificate}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================
// Lesson body renderer
// ============================================================

function LessonBody({ lesson }: { lesson: LessonT }) {
  if (lesson.contentType === "video") {
    return <VideoLessonBody lesson={lesson} />;
  }
  if (lesson.contentType === "pdf") {
    return <PdfLessonBody lesson={lesson} />;
  }
  // default: text
  return <TextLessonBody lesson={lesson} />;
}

function VideoLessonBody({ lesson }: { lesson: LessonT }) {
  return (
    <div className="glass p-3 sm:p-4 animate-glass-in">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-teal via-navy-soft to-navy border border-white/15">
        {/* grid pattern */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* blobs */}
        <div className="absolute -top-12 -right-12 size-44 rounded-full bg-gold/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 size-44 rounded-full bg-teal-soft/25 blur-3xl pointer-events-none" />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <button
            className="size-20 rounded-full bg-white/15 backdrop-blur-md border border-white/35 flex items-center justify-center hover:bg-white/25 transition-all shadow-2xl group"
            aria-label="Main video"
          >
            <CirclePlay className="size-10 text-white group-hover:scale-110 transition-transform" />
          </button>
          <div className="text-white font-display font-semibold text-base sm:text-lg max-w-md">
            {lesson.title}
          </div>
          <div className="text-xs text-white/70 flex items-center gap-1.5">
            <PlayCircle className="size-3.5" />
            Video demo akan dimainkan di sini
          </div>
        </div>

        {/* duration chip */}
        <div className="absolute top-2.5 right-2.5">
          <Badge className="bg-navy/70 text-white border-white/20 backdrop-blur-sm">
            <Clock className="size-3" />
            {formatDuration(lesson.durationMin)}
          </Badge>
        </div>
      </div>

      {/* Optional text companion */}
      {lesson.bodyText && (
        <ProseText body={lesson.bodyText} className="mt-4" />
      )}
    </div>
  );
}

function PdfLessonBody({ lesson }: { lesson: LessonT }) {
  return (
    <div className="glass p-5 sm:p-6 animate-glass-in">
      <div className="flex flex-col items-center text-center py-8">
        <div className="size-20 rounded-2xl bg-gold/15 border border-gold/35 flex items-center justify-center mb-4 text-gold">
          <FileText className="size-10" />
        </div>
        <h3 className="font-display font-semibold text-foreground mb-1">
          Dokumen PDF · {lesson.title}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          Bahan bacaan dalam format PDF tersedia untuk muat turun. Sila baca dokumen lengkap untuk
          memahami topik pelajaran ini.
        </p>
        <Button
          className="bg-gradient-to-r from-gold to-amber-500 text-navy hover:from-amber-500 hover:to-gold shadow-lg shadow-gold/30"
          onClick={() => {
            if (lesson.contentUrl) {
              window.open(lesson.contentUrl, "_blank", "noopener,noreferrer");
            } else {
              toast.info("PDF demo", {
                description: "Fail PDF sebenar akan dimuat turun di sini dalam pelaksanaan penuh.",
              });
            }
          }}
        >
          <Download className="size-4" />
          Muat Turun PDF
        </Button>
      </div>

      {lesson.bodyText && <ProseText body={lesson.bodyText} className="mt-4" />}
    </div>
  );
}

function TextLessonBody({ lesson }: { lesson: LessonT }) {
  return (
    <div className="glass p-5 sm:p-6 animate-glass-in">
      {lesson.bodyText ? (
        <ProseText body={lesson.bodyText} />
      ) : (
        <div className="text-sm text-muted-foreground italic py-6 text-center">
          Kandungan teks untuk pelajaran ini akan dipaparkan di sini.
        </div>
      )}
    </div>
  );
}

function ProseText({ body, className }: { body: string; className?: string }) {
  const paragraphs = useMemo(
    () =>
      body
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
    [body]
  );
  return (
    <div
      className={cn(
        "prose prose-invert max-w-none text-foreground/90 leading-relaxed space-y-3.5",
        "[&_p]:my-0 [&_p]:text-sm sm:[&_p]:text-base [&_p]:leading-[1.75]",
        "[&_strong]:text-foreground [&_strong]:font-semibold",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:text-sm sm:[_ul]:text-base",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
        className
      )}
    >
      {paragraphs.map((p, i) => (
        <p key={i} dangerouslySetInnerHTML={{ __html: simpleFormat(p) }} />
      ))}
    </div>
  );
}

/** Minimal inline formatter: **bold**, *italic*, `code` */
function simpleFormat(text: string): string {
  // Escape HTML first
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+?)`/g, '<code class="px-1 py-0.5 rounded bg-white/10 font-mono text-[0.85em]">$1</code>')
    .replace(/\n/g, "<br/>");
}

// ============================================================
// Quiz section
// ============================================================

interface QuizSectionProps {
  module: CourseModuleT & { quizzes: QuizT[]; lessons: LessonT[] };
  quizAttempts: Record<string, AttemptResult>;
  onAttempt: (quizId: string, selectedAnswer: number) => void;
  attempting: boolean;
}

function QuizSection({ module, quizAttempts, onAttempt, attempting }: QuizSectionProps) {
  const quizzes = module.quizzes ?? [];
  // Only count settled (non-pending) attempts as "answered"
  const attemptedCount = quizzes.filter(
    (q) => quizAttempts[q.id] && !quizAttempts[q.id].isPending
  ).length;
  const correctCount = quizzes.filter(
    (q) => quizAttempts[q.id]?.isCorrect && !quizAttempts[q.id].isPending
  ).length;
  const allAttempted = attemptedCount === quizzes.length;

  return (
    <div className="glass-strong p-5 sm:p-6 mt-5 animate-glass-in">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/12">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-gold/20 border border-gold/40 flex items-center justify-center text-gold">
            <Award className="size-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm sm:text-base">
              Kuiz Modul: {module.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              {attemptedCount}/{quizzes.length} dijawab · {correctCount} betul
            </p>
          </div>
        </div>
        {allAttempted && (
          <Badge className="bg-emerald-500/25 text-emerald-300 border-emerald-500/45">
            <CheckCircle2 className="size-3" /> Modul Selesai
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {quizzes.map((q, qi) => (
          <QuizCard
            key={q.id}
            quiz={q}
            index={qi}
            attempt={quizAttempts[q.id]}
            onAttempt={(ans) => onAttempt(q.id, ans)}
            attempting={attempting}
          />
        ))}
      </div>

      {allAttempted && (
        <div className="mt-5 p-4 rounded-xl bg-white/5 border border-white/12 text-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-muted-foreground">Ringkasan modul ini</span>
            <span className="font-display font-bold text-foreground">
              {correctCount}/{quizzes.length} betul ·{" "}
              <span className="text-gold">
                {Math.round((correctCount / quizzes.length) * 100)}%
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function QuizCard({
  quiz,
  index,
  attempt,
  onAttempt,
  attempting,
}: {
  quiz: QuizT;
  index: number;
  attempt?: AttemptResult;
  onAttempt: (ans: number) => void;
  attempting: boolean;
}) {
  const options = useMemo(() => parseOptions(quiz.optionsJson), [quiz.optionsJson]);
  const isAnswered = !!attempt && !attempt.isPending;
  const isPending = !!attempt?.isPending;
  const isCorrect = attempt?.isCorrect;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all",
        isAnswered
          ? isCorrect
            ? "bg-emerald-500/8 border-emerald-500/30"
            : "bg-red-500/8 border-red-500/30"
          : isPending
          ? "bg-teal/5 border-teal/25"
          : "bg-white/4 border-white/12"
      )}
    >
      <div className="flex items-start gap-2.5 mb-3">
        <div
          className={cn(
            "size-6 rounded-md flex items-center justify-center text-xs font-display font-bold shrink-0",
            isAnswered
              ? isCorrect
                ? "bg-emerald-500/25 text-emerald-300"
                : "bg-red-500/25 text-red-300"
              : isPending
              ? "bg-teal/25 text-teal-soft"
              : "bg-teal/20 text-teal-soft"
          )}
        >
          {isPending ? <Loader2 className="size-3 animate-spin" /> : index + 1}
        </div>
        <h4 className="text-sm sm:text-base font-medium text-foreground leading-relaxed flex-1">
          {quiz.question}
        </h4>
        {quiz.aiGenerated && (
          <Badge className="bg-teal-soft/15 text-teal-soft border-teal-soft/30 text-[9px] px-1.5 py-0 shrink-0">
            <Sparkles className="size-2.5" /> AI
          </Badge>
        )}
      </div>

      <RadioGroup
        value={attempt ? String(attempt.selectedAnswer) : undefined}
        onValueChange={(v) => {
          if (isAnswered || attempting || isPending) return;
          onAttempt(Number(v));
        }}
        disabled={isAnswered || attempting || isPending}
        className="gap-2"
      >
        {options.map((opt, i) => {
          const isThisSelected = attempt?.selectedAnswer === i;
          const isThisCorrect = isAnswered && attempt?.correctAnswer === i;
          return (
            <label
              key={i}
              className={cn(
                "flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all text-sm",
                !isAnswered && !isPending && "border-white/12 hover:bg-white/6 hover:border-white/20",
                isPending && isThisSelected && "bg-teal/10 border-teal/30",
                isAnswered && isThisCorrect && "bg-emerald-500/15 border-emerald-500/40",
                isAnswered && isThisSelected && !isThisCorrect && "bg-red-500/15 border-red-500/40",
                isAnswered && !isThisSelected && !isThisCorrect && "border-white/8 opacity-60",
                (isAnswered || attempting || isPending) && "cursor-default"
              )}
            >
              <RadioGroupItem
                value={String(i)}
                id={`q-${quiz.id}-${i}`}
                className={cn(
                  "mt-0.5",
                  isAnswered && isThisCorrect && "border-emerald-500 text-emerald-500",
                  isAnswered && isThisSelected && !isThisCorrect && "border-red-500 text-red-500"
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="text-foreground/90 leading-relaxed">{opt}</div>
                {isPending && isThisSelected && (
                  <div className="text-[11px] text-teal-soft mt-1 flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" /> Menghantar jawapan…
                  </div>
                )}
                {isAnswered && isThisCorrect && (
                  <div className="text-[11px] text-emerald-300 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Jawapan betul
                  </div>
                )}
                {isAnswered && isThisSelected && !isThisCorrect && (
                  <div className="text-[11px] text-red-300 mt-1 flex items-center gap-1">
                    <XCircle className="size-3" /> Pilihan anda (salah)
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </RadioGroup>

      {isPending && (
        <div className="mt-3 p-2.5 rounded-lg border border-teal/25 bg-teal/8 text-xs flex gap-2 items-center text-teal-soft animate-glass-in">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Menyemak jawapan anda…</span>
        </div>
      )}

      {isAnswered && (
        <div
          className={cn(
            "mt-3 p-3 rounded-lg border text-xs flex gap-2 items-start animate-glass-in",
            isCorrect
              ? "bg-emerald-500/8 border-emerald-500/25 text-emerald-100"
              : "bg-red-500/8 border-red-500/25 text-red-100"
          )}
        >
          {isCorrect ? (
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-semibold mb-0.5">
              {isCorrect ? "Tepat sekali!" : "Belum tepat."}
            </div>
            {quiz.explanation && (
              <div className="text-foreground/80 leading-relaxed">{quiz.explanation}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Final summary / celebration card
// ============================================================

interface FinalSummaryCardProps {
  isCompleted: boolean;
  allQuizzesAttempted: boolean;
  attemptedQuizzes: number;
  totalQuizzes: number;
  correctQuizzes: number;
  allLessonsVisited: boolean;
  score: number | null;
  course: CourseT & {
    modules: (CourseModuleT & {
      lessons: LessonT[];
      quizzes: QuizT[];
    })[];
  };
  quizAttempts: Record<string, AttemptResult>;
  onViewCertificate: () => void;
}

function FinalSummaryCard({
  isCompleted,
  allQuizzesAttempted,
  attemptedQuizzes,
  totalQuizzes,
  correctQuizzes,
  allLessonsVisited,
  score,
  course,
  quizAttempts,
  onViewCertificate,
}: FinalSummaryCardProps) {
  // Modules with unanswered quizzes
  const modulesWithUnanswered = (course.modules ?? [])
    .map((m) => ({
      title: m.title,
      unanswered: (m.quizzes ?? []).filter(
        (q) => !quizAttempts[q.id] || quizAttempts[q.id].isPending
      ).length,
      total: (m.quizzes ?? []).length,
    }))
    .filter((m) => m.unanswered > 0);

  if (isCompleted) {
    return (
      <div className="glass-strong p-6 sm:p-8 mt-5 text-center animate-glass-in relative overflow-hidden">
        {/* decorative blobs */}
        <div className="absolute -top-20 -left-20 size-64 rounded-full bg-gold/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 size-64 rounded-full bg-teal-soft/20 blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="size-20 rounded-full bg-gradient-to-br from-gold to-amber-500 border-2 border-gold/50 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-gold/30">
            <Trophy className="size-10 text-navy" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-gradient-gold mb-2">
            Tahniah! Anda telah menamatkan kursus ini.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto mb-5">
            Anda telah berjaya menyelesaikan semua pelajaran dan kuiz dengan skor lulus. Sijil
            penyempurnaan telah diterbitkan atas nama anda.
          </p>

          <div className="inline-flex items-center gap-3 glass p-4 rounded-xl mb-5">
            <Medal className="size-8 text-gold" />
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Skor Akhir
              </div>
              <div className="font-display text-3xl font-bold text-gradient-gold">
                {score ?? 0}%
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              onClick={onViewCertificate}
              className="bg-gradient-to-r from-gold to-amber-500 text-navy hover:from-amber-500 hover:to-gold shadow-lg shadow-gold/30"
            >
              <Award className="size-4" />
              Lihat Sijil
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Not yet completed — show progress + what's remaining
  return (
    <div className="glass p-5 sm:p-6 mt-5 animate-glass-in">
      <div className="flex items-start gap-3 mb-4">
        <div className="size-10 rounded-xl bg-teal/20 border border-teal/40 flex items-center justify-center text-teal-soft shrink-0">
          <BarChart3 className="size-5" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground text-base">
            Status Kursus — Belum Selesai
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selesaikan semua kuiz dengan skor ≥ 70% untuk menerima sijil.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl bg-white/5 border border-white/12 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Pelajaran Dilawati
          </div>
          <div className="font-display font-bold text-foreground text-lg">
            {allLessonsVisited ? "Semua" : "Sebahagian"}
          </div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/12 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Kuiz Dijawab
          </div>
          <div className="font-display font-bold text-foreground text-lg">
            {attemptedQuizzes}/{totalQuizzes}
          </div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/12 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Skor Semasa
          </div>
          <div className="font-display font-bold text-gold text-lg">
            {totalQuizzes > 0 ? Math.round((correctQuizzes / totalQuizzes) * 100) : 0}%
          </div>
        </div>
      </div>

      {!allQuizzesAttempted && modulesWithUnanswered.length > 0 && (
        <div className="rounded-xl bg-gold/8 border border-gold/25 p-3.5">
          <div className="text-xs font-medium text-gold mb-2 flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            Modul dengan kuiz belum dijawab:
          </div>
          <ul className="space-y-1 text-xs text-foreground/80">
            {modulesWithUnanswered.map((m) => (
              <li key={m.title} className="flex items-center justify-between gap-2">
                <span className="truncate">{m.title}</span>
                <Badge className="bg-gold/20 text-gold border-gold/40 text-[10px]">
                  {m.unanswered}/{m.total} baki
                </Badge>
              </li>
            ))}
          </ul>
          <div className="text-[11px] text-muted-foreground mt-2">
            Tip: Navigasi ke pelajaran terakhir setiap modul untuk membuka kuiznya.
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// View 3 — Certificate
// ============================================================

interface CertificateViewProps {
  enrollmentId: string;
  onBack: () => void;
  onViewPlayer: () => void;
}

function CertificateView({ enrollmentId, onBack, onViewPlayer }: CertificateViewProps) {
  const q = useQuery<CertificateData>({
    queryKey: ["certificate", enrollmentId],
    queryFn: async () => {
      const r = await fetch(`/api/enrollments/${enrollmentId}/certificate`, {
        credentials: "include",
      });
      if (!r.ok) {
        const e = await r.json().catch(() => null);
        throw new Error(e?.error || "Gagal memuatkan sijil");
      }
      return r.json();
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-5 py-5 sm:py-7 animate-glass-in">
      {/* Top bar — hidden on print */}
      <div className="flex items-center justify-between gap-3 mb-5 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-foreground/75 hover:text-foreground hover:bg-white/8"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Katalog
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewPlayer}
          className="text-foreground/75 hover:text-foreground hover:bg-white/8"
        >
          <BookOpen className="size-4" />
          Lihat Pelajaran
        </Button>
      </div>

      {q.isLoading && (
        <div className="glass-strong p-12 flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-gold" />
          <div className="text-sm text-muted-foreground">Memuatkan sijil…</div>
        </div>
      )}

      {q.isError && (
        <div className="glass-strong p-8 text-center">
          <div className="size-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-3">
            <Lock className="size-7 text-red-300" />
          </div>
          <h2 className="font-display text-lg font-bold text-foreground mb-1">
            Sijil Belum Tersedia
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
            {q.error?.message ??
              "Selesaikan kursus dengan skor ≥ 70% untuk menerima sijil penyempurnaan."}
          </p>
          <Button variant="outline" size="sm" onClick={onBack} className="border-white/20">
            <ArrowLeft className="size-4" /> Kembali
          </Button>
        </div>
      )}

      {q.data && <CertificateCard data={q.data} />}
    </div>
  );
}

function CertificateCard({ data }: { data: CertificateData }) {
  const { certificate, user, course, enrollment } = data;

  const handleDownload = () => {
    toast.success("Sijil disediakan untuk cetakan", {
      description: "Pilih 'Save as PDF' dalam dialog cetakan untuk muat turun sijil.",
      icon: <Download className="size-4 text-gold" />,
    });
    setTimeout(() => window.print(), 400);
  };

  return (
    <>
      {/* On-screen card */}
      <div className="glass-strong p-2 sm:p-3 animate-glass-in relative overflow-hidden">
        {/* Gold gradient border effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gold via-amber-400 to-gold opacity-90 pointer-events-none" />
        <div className="relative m-[2px] rounded-2xl bg-gradient-to-br from-navy via-[#0a1a35] to-navy-soft p-6 sm:p-10 lg:p-12">
          {/* inner border */}
          <div className="absolute inset-3 sm:inset-4 rounded-xl border-2 border-gold/40 pointer-events-none" />
          <div className="absolute inset-4 sm:inset-5 rounded-lg border border-gold/20 pointer-events-none" />

          {/* corner flourishes */}
          <CornerFlourish className="top-3 left-3" />
          <CornerFlourish className="top-3 right-3 rotate-90" />
          <CornerFlourish className="bottom-3 left-3 -rotate-90" />
          <CornerFlourish className="bottom-3 right-3 rotate-180" />

          <div className="relative text-center py-6 sm:py-8">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="size-14 rounded-2xl bg-gradient-to-br from-teal to-navy-soft border border-gold/50 flex items-center justify-center shadow-xl">
                <ShieldCheck className="size-8 text-gold" />
              </div>
              <div className="text-left">
                <div className="font-display font-extrabold text-xl text-gradient-gold leading-tight">
                  SIRI-AI
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  Jabatan Tenaga Manusia
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="mb-1 text-xs uppercase tracking-[0.3em] text-gold/80 font-medium">
              Sijil Penyempurnaan Kursus
            </div>
            <div className="mx-auto w-24 h-px bg-gradient-to-r from-transparent via-gold to-transparent mb-8" />

            <div className="text-sm text-muted-foreground italic mb-2">Ini diakui bahawa</div>

            <div className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-1 tracking-wide">
              {user.name}
            </div>
            {user.position && (
              <div className="text-xs text-muted-foreground mb-1">
                {user.position}
                {user.unit ? ` · ${user.unit}` : ""}
              </div>
            )}

            <div className="text-sm text-muted-foreground italic mt-3 mb-2">
              telah berjaya menamatkan kursus
            </div>

            <div className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-gradient-teal mb-6">
              {course.title}
            </div>

            {/* Score badge */}
            <div className="inline-flex items-center gap-3 glass px-5 py-3 rounded-xl mb-6">
              <Medal className="size-7 text-gold" />
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Skor Dicapai
                </div>
                <div className="font-display text-2xl font-bold text-gradient-gold">
                  {certificate.score}%
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 max-w-xl mx-auto text-left mb-8">
              <div className="glass p-3 rounded-lg">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  No. Sijil
                </div>
                <div className="font-mono text-sm text-foreground break-all">
                  {certificate.certificateNo}
                </div>
              </div>
              <div className="glass p-3 rounded-lg">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  Tarikh Diterbitkan
                </div>
                <div className="text-sm text-foreground">
                  {formatDateLong(certificate.issuedAt)}
                </div>
              </div>
            </div>

            {/* Signature line */}
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 mt-10 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="font-display italic text-gold text-sm mb-1">
                  SIRI-AI e-Learning System
                </div>
                <div className="w-44 h-px bg-foreground/40 mx-auto mb-1" />
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Platform Pengesahan
                </div>
              </div>
              <div className="text-center">
                <div className="font-display italic text-gold text-sm mb-1">
                  Jabatan Tenaga Manusia
                </div>
                <div className="w-44 h-px bg-foreground/40 mx-auto mb-1" />
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Malaysia
                </div>
              </div>
            </div>

            <div className="mt-8 text-[10px] text-muted-foreground/70 max-w-md mx-auto">
              Sijil ini diterbitkan secara automatik oleh SIRI-AI JTM selepas peserta menamatkan
              semua modul dan lulus kuiz dengan skor sekurang-kurangnya 70%. Penyenaraian ini boleh
              disahkan melalui No. Sijil di atas.
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons — hidden on print */}
      <div className="flex flex-wrap gap-2 justify-center mt-5 print:hidden">
        <Button
          onClick={handleDownload}
          className="bg-gradient-to-r from-gold to-amber-500 text-navy hover:from-amber-500 hover:to-gold shadow-lg shadow-gold/30"
        >
          <Download className="size-4" />
          Muat Turun Sijil
        </Button>
      </div>
    </>
  );
}

function CornerFlourish({ className }: { className?: string }) {
  return (
    <svg
      className={cn("absolute size-8 text-gold/50 pointer-events-none", className)}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 2 L14 2 M2 2 L2 14 M2 2 L8 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="2" cy="2" r="1.5" fill="currentColor" />
    </svg>
  );
}
