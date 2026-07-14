"use client";

import { create } from "zustand";

export type ModuleId = "dashboard" | "video_studio" | "elearning";

interface AppState {
  activeModule: ModuleId;
  setActiveModule: (m: ModuleId) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeModule: "dashboard",
  setActiveModule: (m) => set({ activeModule: m, sidebarOpen: false }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));

/** Type for API responses */
export interface ApiError {
  error: string;
  details?: unknown;
}

export interface TaskT {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  unit?: string | null;
  progress: number;
  dueDate?: string | null;
  assigneeId?: string | null;
  assignee?: { id: string; name: string; email: string; unit?: string | null } | null;
}

export interface MeetingT {
  id: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  agenda?: string | null;
  minutes?: string | null;
  aiSummary?: string | null;
  status: string;
  createdById?: string | null;
  participants?: Array<{ id: string; userId: string; attending: string; user: { id: string; name: string } }>;
  actionItems?: Array<{ id: string; title: string; dueDate?: string | null; completed: boolean; assignee?: { id: string; name: string } | null }>;
}

export interface KeyTaskT {
  id: string;
  title: string;
  description?: string | null;
  target?: string | null;
  kpi?: string | null;
  achievementPct: number;
  unit?: string | null;
  status: string;
  dueDate?: string | null;
  owner?: { id: string; name: string; email: string; unit?: string | null } | null;
}

export interface BulletinT {
  id: string;
  title: string;
  body: string;
  category: string;
  imageUrl?: string | null;
  pinned: boolean;
  archived: boolean;
  publishedAt: string;
  createdById?: string | null;
  creator?: { id: string; name: string } | null;
}

export interface VideoProjectT {
  id: string;
  title: string;
  theme: string;
  description?: string | null;
  status: string;
  conceptNotes?: string | null;
  script?: string | null;
  scriptLang: string;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  scenes?: VideoSceneT[];
  assets?: VideoAssetT[];
  approvals?: VideoApprovalT[];
  creator?: { id: string; name: string } | null;
}

export interface VideoSceneT {
  id: string;
  projectId: string;
  sceneOrder: number;
  title: string;
  description: string;
  visualPrompt?: string | null;
  durationSec: number;
  notes?: string | null;
}

export interface VideoAssetT {
  id: string;
  projectId: string;
  fileName: string;
  fileUrl: string;
  assetType: string;
  fileSize?: number | null;
  uploadedById?: string | null;
  createdAt: string;
}

export interface VideoApprovalT {
  id: string;
  projectId: string;
  reviewerId?: string | null;
  reviewer?: { id: string; name: string } | null;
  status: string;
  comment?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface CourseT {
  id: string;
  title: string;
  description?: string | null;
  level: string;
  thumbnailUrl?: string | null;
  modules?: CourseModuleT[];
  enrollments?: EnrollmentT[];
}

export interface CourseModuleT {
  id: string;
  courseId: string;
  moduleOrder: number;
  title: string;
  description?: string | null;
  lessons?: LessonT[];
  quizzes?: QuizT[];
}

export interface LessonT {
  id: string;
  moduleId: string;
  lessonOrder: number;
  title: string;
  contentType: string;
  contentUrl?: string | null;
  bodyText?: string | null;
  durationMin: number;
}

export interface QuizT {
  id: string;
  moduleId: string;
  question: string;
  optionsJson: string;
  correctAnswer: number;
  aiGenerated: boolean;
  explanation?: string | null;
}

export interface EnrollmentT {
  id: string;
  courseId: string;
  userId: string;
  progressPct: number;
  status: string;
  score?: number | null;
  enrolledAt: string;
  completedAt?: string | null;
  user?: { id: string; name: string; email: string; unit?: string | null } | null;
  certificates?: CertificateT[];
}

export interface CertificateT {
  id: string;
  enrollmentId: string;
  certificateNo: string;
  issuedAt: string;
  score: number;
  certificateUrl?: string | null;
}

export interface UserT {
  id: string;
  email: string;
  name: string;
  role: string;
  unit?: string | null;
  position?: string | null;
}
