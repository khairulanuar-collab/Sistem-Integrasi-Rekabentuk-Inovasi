"use client";

/**
 * SIRI-AI JTM — Modul 1: Studio Video Kemerdekaan AI
 *
 * Penghasilan video berbantukan GLM-5.2:
 *  - View 1: Senarai Projek (default)
 *  - View 2: Editor Projek (konsep + skrip + papan cerita + aset + kelulusan + eksport)
 *
 * RBAC: ADMIN, MANAGER, CREATIVE. Approve: ADMIN, MANAGER. Delete: ADMIN.
 * AI Generate: ADMIN, MANAGER, OFFICER, CREATIVE.
 */

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles, Clapperboard, Film, Image as ImageIcon, Music, FileText,
  Upload, Download, Check, X, AlertCircle, ArrowLeft, Plus, GripVertical,
  Trash2, Clock, Loader2, Wand2, Save, Tag, ListVideo, FolderOpen,
  ShieldCheck, ScrollText, Layers,
} from "lucide-react";

import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { canPerform, type Role } from "@/lib/security";
import {
  formatDate, formatDateTime, relativeTime, initials,
  formatFileSize, formatDurationSec,
} from "@/lib/format";
import type {
  VideoProjectT, VideoSceneT, VideoAssetT, VideoApprovalT, UserT,
} from "@/lib/store";

// ============================================================
// Status helpers
// ============================================================

const STATUS_META: Record<string, { label: string; pill: string }> = {
  draft:               { label: "Draf",             pill: "pill-pending"   },
  in_review:           { label: "Dalam Semakan",    pill: "pill-review"    },
  approved:            { label: "Diluluskan",       pill: "pill-approved"  },
  ready_for_production:{ label: "Sedia Produksi",   pill: "pill-approved"  },
  rejected:            { label: "Ditolak",          pill: "pill-rejected"  },
};

function statusLabel(s: string): string { return STATUS_META[s]?.label ?? s; }
function statusPill(s: string): string { return STATUS_META[s]?.pill ?? "pill-pending"; }

const APPROVAL_META: Record<string, { label: string; pill: string }> = {
  approved:           { label: "Diluluskan",       pill: "pill-approved" },
  rejected:           { label: "Ditolak",          pill: "pill-rejected" },
  changes_requested:  { label: "Perubahan Diminta", pill: "pill-review"  },
};

// ============================================================
// Top-level component
// ============================================================

export function VideoStudioModule() {
  const { data: session } = useSession();
  const role = (session?.user?.role ?? null) as Role | null;
  const [view, setView] = useState<"list" | "detail">("list");
  const [openId, setOpenId] = useState<string | null>(null);

  // RBAC gate — must be able to READ video_projects (ADMIN/MANAGER/CREATIVE)
  if (!canPerform("video_projects", "read", role)) {
    return (
      <div className="glass-strong p-8 max-w-2xl mx-auto mt-12 text-center animate-glass-in">
        <AlertCircle className="size-10 text-amber-300 mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold text-foreground">Akses Terhad</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Modul Studio Video Kemerdekaan AI hanya tersedia untuk peranan
          Pentadbir, Pengurus, dan Krew Kreatif sahaja.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-6 lg:py-8 space-y-6">
      {view === "list" && <ProjectListView role={role} onOpen={(id) => {
        setOpenId(id); setView("detail");
      }} />}
      {view === "detail" && openId && (
        <ProjectDetailView
          role={role}
          projectId={openId}
          onBack={() => { setView("list"); setOpenId(null); }}
        />
      )}
    </div>
  );
}

// ============================================================
// View 1: Project List
// ============================================================

const FILTERS = [
  { id: "all",    label: "Semua",           status: "" },
  { id: "draft",  label: "Draf",            status: "draft" },
  { id: "review", label: "Dalam Semakan",   status: "in_review" },
  { id: "approved", label: "Diluluskan",    status: "approved" },
  { id: "production", label: "Sedia Produksi", status: "ready_for_production" },
];

interface ProjectListItem extends VideoProjectT {
  scenes?: VideoSceneT[];
  assets?: VideoAssetT[];
  approvals?: VideoApprovalT[];
  _count?: { scenes: number; assets: number; approvals: number };
}

function ProjectListView({
  role, onOpen,
}: { role: Role; onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const statusParam = FILTERS.find((f) => f.id === filter)?.status ?? "";
  const { data, isLoading } = useQuery<{ projects: ProjectListItem[] }>({
    queryKey: ["video-projects", statusParam],
    queryFn: async () => {
      const url = statusParam
        ? `/api/video-projects?status=${statusParam}`
        : `/api/video-projects`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("Gagal memuatkan projek");
      return r.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async (body: { title: string; theme: string; description?: string; scriptLang: string }) => {
      const r = await fetch("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Gagal mencipta projek");
      }
      return r.json() as Promise<{ project: VideoProjectT }>;
    },
    onSuccess: ({ project }) => {
      toast.success("Projek dicipta", { description: project.title });
      qc.invalidateQueries({ queryKey: ["video-projects"] });
      setCreateOpen(false);
      onOpen(project.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const projects = data?.projects ?? [];
  const canWrite = canPerform("video_projects", "write", role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-glass-in">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gold/90 mb-1">
            <Clapperboard className="size-3.5" />
            Modul 1 · Penghasilan video berbantukan GLM-5.2
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gradient-gold leading-tight">
            Studio Video Kemerdekaan AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            Hasilkan konsep, skrip, dan papan cerita untuk Video Kemerdekaan JTM
            dengan bantuan GLM-5.2. Luluskan, kemaskini, dan eksport spesifikasi
            produksi dalam satu studio.
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-gradient-to-r from-teal to-teal-soft hover:from-teal-soft hover:to-teal text-white shadow-lg shadow-teal/30"
          >
            <Plus className="size-4" />
            Projek Baharu
          </Button>
        )}
      </header>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 animate-glass-in">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border",
              filter === f.id
                ? "bg-teal/30 border-teal/50 text-teal-soft"
                : "glass border-white/15 text-foreground/70 hover:text-foreground hover:border-white/30"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <ProjectGridSkeleton />
      ) : projects.length === 0 ? (
        <EmptyState canWrite={canWrite} onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-glass-in">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(b) => createMut.mutate(b)}
        loading={createMut.isPending}
      />
    </div>
  );
}

function ProjectCard({
  project, onOpen,
}: { project: ProjectListItem; onOpen: () => void }) {
  const sceneCount = project._count?.scenes ?? project.scenes?.length ?? 0;
  const assetCount = project._count?.assets ?? project.assets?.length ?? 0;
  return (
    <button
      onClick={onOpen}
      className="glass glass-hover p-5 text-left flex flex-col gap-3 animate-glass-in"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium", statusPill(project.status))}>
          {statusLabel(project.status)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {relativeTime(project.updatedAt)}
        </span>
      </div>
      <h3 className="font-display font-bold text-base sm:text-lg text-foreground line-clamp-2 leading-tight">
        {project.title}
      </h3>
      <div className="flex items-center gap-1.5 text-gold text-xs">
        <Sparkles className="size-3.5" />
        <span className="truncate">{project.theme}</span>
      </div>
      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {project.description}
        </p>
      )}
      <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Film className="size-3" /> {sceneCount} adegan
          </span>
          <span className="flex items-center gap-1">
            <Layers className="size-3" /> {assetCount} aset
          </span>
        </div>
        <span className="truncate max-w-[110px]">{project.creator?.name ?? "—"}</span>
      </div>
    </button>
  );
}

function ProjectGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass p-5 h-48 animate-pulse">
          <div className="h-3 w-20 rounded-full bg-white/10 mb-3" />
          <div className="h-5 w-3/4 rounded bg-white/10 mb-2" />
          <div className="h-3 w-1/2 rounded bg-white/10 mb-4" />
          <div className="h-3 w-full rounded bg-white/5 mb-1.5" />
          <div className="h-3 w-5/6 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ canWrite, onCreate }: { canWrite: boolean; onCreate: () => void }) {
  return (
    <div className="glass-strong p-10 text-center animate-glass-in">
      <div className="size-14 rounded-2xl bg-teal/20 border border-teal/40 flex items-center justify-center mx-auto mb-4">
        <Clapperboard className="size-7 text-teal-soft" />
      </div>
      <h3 className="font-display text-lg font-bold text-foreground">Belum ada projek video</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
        Cipta projek baharu untuk mula menjana konsep, skrip, dan papan cerita
        dengan GLM-5.2.
      </p>
      {canWrite && (
        <Button onClick={onCreate} className="mt-5 bg-gradient-to-r from-teal to-teal-soft text-white">
          <Plus className="size-4" /> Cipta Projek Pertama
        </Button>
      )}
    </div>
  );
}

function CreateProjectDialog({
  open, onOpenChange, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (b: { title: string; theme: string; description?: string; scriptLang: string }) => void;
  loading: boolean;
}) {
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [scriptLang, setScriptLang] = useState("ms");

  function handleOpenChange(o: boolean) {
    if (!o) {
      setTitle(""); setTheme(""); setDescription(""); setScriptLang("ms");
    }
    onOpenChange(o);
  }

  function submit() {
    if (!title.trim() || !theme.trim()) {
      toast.error("Tajuk dan tema diperlukan");
      return;
    }
    onSubmit({ title: title.trim(), theme: theme.trim(), description: description.trim() || undefined, scriptLang });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass-strong border-white/25 text-foreground max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Projek Video Baharu</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Isi maklumat asas. Konsep dan skrip boleh dijana selepas projek dicipta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="np-title">Tajuk Projek *</Label>
            <Input id="np-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="cth: Video Kemerdekaan JTM 2026"
              className="bg-white/8 border-white/20" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-theme">Tema *</Label>
            <Input id="np-theme" value={theme} onChange={(e) => setTheme(e.target.value)}
              placeholder="cth: Perpaduan dalam Kepelbagaian"
              className="bg-white/8 border-white/20" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-desc">Penerangan</Label>
            <Textarea id="np-desc" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Ringkasan objektif & sasaran penonton…"
              className="bg-white/8 border-white/20 min-h-24" />
          </div>
          <div className="space-y-1.5">
            <Label>Bahasa Skrip</Label>
            <Select value={scriptLang} onValueChange={setScriptLang}>
              <SelectTrigger className="bg-white/8 border-white/20 w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-dark border-white/20">
                <SelectItem value="ms">Bahasa Malaysia</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" className="text-foreground/80">Batal</Button>
          </DialogClose>
          <Button onClick={submit} disabled={loading}
            className="bg-gradient-to-r from-teal to-teal-soft text-white">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Cipta Projek
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// View 2: Project Detail (Editor)
// ============================================================

interface ProjectDetail extends VideoProjectT {
  scenes: VideoSceneT[];
  assets: VideoAssetT[];
  approvals: VideoApprovalT[];
}

function ProjectDetailView({
  role, projectId, onBack,
}: { role: Role; projectId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ project: ProjectDetail }>({
    queryKey: ["video-project", projectId],
    queryFn: async () => {
      const r = await fetch(`/api/video-projects/${projectId}`);
      if (!r.ok) throw new Error("Gagal memuatkan projek");
      return r.json();
    },
  });

  const project = data?.project;
  const canWrite = canPerform("video_projects", "write", role);
  const canApprove = canPerform("video_projects", "approve", role);
  const canDelete = canPerform("video_projects", "delete", role);
  const canAI = canPerform("ai_generate", "read", role);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const patchMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/video-projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Galam mengemas kini");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-project", projectId] });
      qc.invalidateQueries({ queryKey: ["video-projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/video-projects/${projectId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Gagal memadam projek");
    },
    onSuccess: () => {
      toast.success("Projek dipadam");
      qc.invalidateQueries({ queryKey: ["video-projects"] });
      onBack();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-glass-in">
        <BackButton onClick={onBack} />
        <div className="glass p-8 h-32 animate-pulse" />
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="glass p-6 h-64 animate-pulse" />
            <div className="glass p-6 h-64 animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="glass p-6 h-48 animate-pulse" />
            <div className="glass p-6 h-48 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="glass-strong p-8 text-center">
        <AlertCircle className="size-8 text-amber-300 mx-auto mb-2" />
        <p className="text-foreground">Projek tidak dijumpai.</p>
        <Button onClick={onBack} variant="outline" className="mt-4">Kembali</Button>
      </div>
    );
  }

  const totalDuration = project.scenes.reduce((sum, s) => sum + (s.durationSec || 0), 0);

  return (
    <div className="space-y-5 animate-glass-in">
      <BackButton onClick={onBack} canDelete={canDelete} onDelete={() => setDeleteOpen(true)} />

      {/* Header */}
      <div className="glass-strong p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium", statusPill(project.status))}>
                {statusLabel(project.status)}
              </span>
              <Badge variant="outline" className="border-gold/40 text-gold bg-gold/10">
                <Tag className="size-3 mr-1" /> {project.theme}
              </Badge>
              <Badge variant="outline" className="border-teal/40 text-teal-soft bg-teal/10">
                {project.scriptLang === "ms" ? "BM" : "EN"}
              </Badge>
            </div>
            <EditableTitle
              value={project.title}
              canEdit={canWrite}
              onSave={(title) => patchMut.mutate({ title })}
              loading={patchMut.isPending}
            />
            {project.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground pt-1">
              <span className="flex items-center gap-1"><FolderOpen className="size-3" /> {project.creator?.name ?? "—"}</span>
              <span className="flex items-center gap-1"><Clock className="size-3" /> Dicipta {formatDate(project.createdAt)}</span>
              <span className="flex items-center gap-1"><Clock className="size-3" /> Dikemaskini {relativeTime(project.updatedAt)}</span>
            </div>
          </div>

          {canApprove && project.status !== "approved" && (
            <ApprovalQuickActions projectId={projectId} />
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <ConceptCard
            project={project}
            canWrite={canWrite}
            canAI={canAI}
            onPatch={(conceptNotes) => patchMut.mutate({ conceptNotes })}
            patchLoading={patchMut.isPending}
          />
          <ScriptCard
            project={project}
            canWrite={canWrite}
            canAI={canAI}
            onPatch={(body) => patchMut.mutate(body)}
            patchLoading={patchMut.isPending}
          />
          <StoryboardCard
            projectId={projectId}
            scenes={project.scenes}
            canWrite={canWrite}
            canAI={canAI}
          />
        </div>

        <div className="space-y-5">
          <AssetsCard projectId={projectId} assets={project.assets} canWrite={canWrite} />
          <ApprovalsCard projectId={projectId} approvals={project.approvals} canApprove={canApprove} projectStatus={project.status} />
          <ExportCard projectId={projectId} sceneCount={project.scenes.length} totalDuration={totalDuration} assetCount={project.assets.length} />
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="glass-strong border-white/25 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Padam projek ini?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tindakan ini tidak boleh diundur. Semua adegan, aset, dan rekod kelulusan akan turut dipadam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/20">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Padam Projek
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BackButton({ onClick, canDelete, onDelete }: {
  onClick: () => void; canDelete?: boolean; onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button onClick={onClick} variant="ghost" className="text-foreground/80 hover:text-foreground hover:bg-white/8">
        <ArrowLeft className="size-4" /> Kembali ke Senarai
      </Button>
      {canDelete && onDelete && (
        <Button onClick={onDelete} variant="ghost" size="sm" className="text-red-300 hover:bg-red-500/15 hover:text-red-200">
          <Trash2 className="size-4" /> Padam
        </Button>
      )}
    </div>
  );
}

// ============================================================
// Editable Title (inline edit)
// ============================================================

function EditableTitle({
  value, canEdit, onSave, loading,
}: { value: string; canEdit: boolean; onSave: (v: string) => void; loading: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  if (!canEdit) {
    return <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground leading-tight">{value}</h2>;
  }

  if (!editing) {
    return (
      <h2
        onClick={() => setEditing(true)}
        title="Klik untuk edit"
        className="font-display text-xl sm:text-2xl font-bold text-foreground leading-tight cursor-text hover:text-gold transition-colors"
      >
        {value}
      </h2>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="bg-white/8 border-white/20 font-display text-xl font-bold h-11"
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(draft.trim() || value); setEditing(false); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
      />
      <Button size="icon" disabled={loading || !draft.trim()}
        onClick={() => { onSave(draft.trim() || value); setEditing(false); }}
        className="bg-teal hover:bg-teal/80 text-white">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      </Button>
      <Button size="icon" variant="ghost" onClick={() => { setDraft(value); setEditing(false); }}
        className="text-foreground/70 hover:bg-white/8">
        <X className="size-4" />
      </Button>
    </div>
  );
}

// ============================================================
// AI Button — gradient gold/teal, GLM-5.2 badge
// ============================================================

function AiButton({
  onClick, loading, disabled, children, size = "default",
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  size?: "sm" | "default";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-lg font-medium text-white transition-all",
        "bg-gradient-to-r from-gold via-amber-500 to-teal shadow-lg shadow-gold/20",
        "hover:shadow-gold/40 hover:brightness-110 disabled:opacity-60 disabled:pointer-events-none",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      {children}
      <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/15 text-[9px] font-bold tracking-wide">
        GLM-5.2
      </span>
    </button>
  );
}

// ============================================================
// Card: AI Concept Generator
// ============================================================

function ConceptCard({
  project, canWrite, canAI, onPatch, patchLoading,
}: {
  project: ProjectDetail;
  canWrite: boolean;
  canAI: boolean;
  onPatch: (conceptNotes: string) => void;
  patchLoading: boolean;
}) {
  const [theme, setTheme] = useState(project.theme);
  const [concept, setConcept] = useState(project.conceptNotes ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setTheme(project.theme); }, [project.theme]);
  useEffect(() => { setConcept(project.conceptNotes ?? ""); }, [project.conceptNotes]);

  async function generate() {
    if (!canAI) { toast.error("Anda tiada kebenaran untuk penjanaan AI"); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "video_concept",
          prompt: theme,
          context: { theme },
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Gagal menjana konsep");
      }
      const data = await r.json();
      setConcept(data.content ?? "");
      toast.success("Konsep AI dijana", { description: `${data.tokensUsed ?? 0} token · ${data.model ?? "GLM"}` });
    } catch (e) {
      toast.error("Gagal menjana konsep", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function save() {
    if (!concept.trim()) { toast.error("Konsep masih kosong"); return; }
    onPatch(concept);
    toast.success("Konsep disimpan");
  }

  return (
    <section className="glass p-5 sm:p-6 animate-glass-in">
      <CardHeader
        icon={<Wand2 className="size-5" />}
        title="Penjana Konsep AI"
        subtitle="GLM-5.2 menjana 3 cadangan konsep kreatif berdasarkan tema."
      />
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-foreground/90">Tema</Label>
          <Input value={theme} onChange={(e) => setTheme(e.target.value)} disabled={!canWrite}
            className="bg-white/8 border-white/20" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-foreground/90">Cadangan Konsep (boleh edit)</Label>
          <Textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            readOnly={!canWrite}
            placeholder="Klik 'Janakan Konsep AI' untuk mula…"
            className="bg-white/8 border-white/20 min-h-44 font-mono text-xs leading-relaxed"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <AiButton onClick={generate} loading={loading} disabled={!canWrite || !canAI}>
            Janakan Konsep AI
          </AiButton>
          {canWrite && (
            <Button onClick={save} disabled={patchLoading || !concept.trim()} variant="outline"
              className="bg-white/5 border-white/20 text-foreground hover:bg-white/10">
              {patchLoading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Simpan Konsep
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Card: AI Script Generator
// ============================================================

function ScriptCard({
  project, canWrite, canAI, onPatch, patchLoading,
}: {
  project: ProjectDetail;
  canWrite: boolean;
  canAI: boolean;
  onPatch: (body: Record<string, unknown>) => void;
  patchLoading: boolean;
}) {
  const [lang, setLang] = useState(project.scriptLang ?? "ms");
  const [script, setScript] = useState(project.script ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setLang(project.scriptLang ?? "ms"); }, [project.scriptLang]);
  useEffect(() => { setScript(project.script ?? ""); }, [project.script]);

  async function generate() {
    if (!canAI) { toast.error("Anda tiada kebenaran untuk penjanaan AI"); return; }
    setLoading(true);
    try {
      const promptParts = [project.theme];
      if (project.conceptNotes) promptParts.push(`Konsep: ${project.conceptNotes}`);
      promptParts.push(`Bahasa: ${lang === "ms" ? "Bahasa Malaysia" : "English"}`);
      const r = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "video_script",
          prompt: promptParts.join("\n"),
          context: { theme: project.theme, concept: project.conceptNotes ?? "" },
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Gagal menjana skrip");
      }
      const data = await r.json();
      setScript(data.content ?? "");
      toast.success("Skrip AI dijana", { description: `${data.tokensUsed ?? 0} token · ${data.model ?? "GLM"}` });
    } catch (e) {
      toast.error("Gagal menjana skrip", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function save() {
    onPatch({ script, scriptLang: lang });
    toast.success("Skrip disimpan");
  }

  return (
    <section className="glass p-5 sm:p-6 animate-glass-in">
      <CardHeader
        icon={<ScrollText className="size-5" />}
        title="Penjana Skrip AI"
        subtitle="Draf skrip naratif 60-90 saat dengan tag [ADEGAN N]."
        action={
          <Select value={lang} onValueChange={setLang} disabled={!canWrite}>
            <SelectTrigger className="bg-white/8 border-white/20 w-28" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-dark border-white/20">
              <SelectItem value="ms">Bahasa Malaysia</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="space-y-3">
        <Textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          readOnly={!canWrite}
          placeholder="Klik 'Janakan Skrip AI' untuk mula…"
          className="bg-white/8 border-white/20 min-h-56 font-mono text-xs leading-relaxed"
        />
        <div className="flex flex-wrap items-center gap-2">
          <AiButton onClick={generate} loading={loading} disabled={!canWrite || !canAI}>
            Janakan Skrip AI
          </AiButton>
          {canWrite && (
            <Button onClick={save} disabled={patchLoading} variant="outline"
              className="bg-white/5 border-white/20 text-foreground hover:bg-white/10">
              {patchLoading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Simpan Skrip
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Card: Storyboard Builder (drag-and-drop scenes)
// ============================================================

function StoryboardCard({
  projectId, scenes, canWrite, canAI,
}: {
  projectId: string;
  scenes: VideoSceneT[];
  canWrite: boolean;
  canAI: boolean;
}) {
  const qc = useQueryClient();
  const [items, setItems] = useState<VideoSceneT[]>(scenes);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => { setItems(scenes); }, [scenes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const createMut = useMutation({
    mutationFn: async (body: { title: string; description: string; durationSec?: number; notes?: string }) => {
      const r = await fetch("/api/video-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...body }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Gagal mencipta adegan");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Adegan baharu ditambah");
      qc.invalidateQueries({ queryKey: ["video-project", projectId] });
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMut = useMutation({
    mutationFn: async (newItems: VideoSceneT[]) => {
      const r = await fetch("/api/video-scenes/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: newItems.map((s, i) => ({ id: s.id, sceneOrder: i + 1 })) }),
      });
      if (!r.ok) throw new Error("Gagal menyusun semula adegan");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      // Rollback
      qc.invalidateQueries({ queryKey: ["video-project", projectId] });
    },
  });

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((curr) => {
      const oldIndex = curr.findIndex((s) => s.id === active.id);
      const newIndex = curr.findIndex((s) => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return curr;
      const next = arrayMove(curr, oldIndex, newIndex).map((s, i) => ({ ...s, sceneOrder: i + 1 }));
      reorderMut.mutate(next);
      return next;
    });
  }

  return (
    <section className="glass p-5 sm:p-6 animate-glass-in">
      <CardHeader
        icon={<ListVideo className="size-5" />}
        title="Papan Cerita"
        subtitle={`${scenes.length} adegan · susun semula dengan seret`}
        action={canWrite && (
          <Button onClick={() => setAddOpen(true)} size="sm"
            className="bg-gradient-to-r from-teal to-teal-soft text-white">
            <Plus className="size-4" /> Adegan Baharu
          </Button>
        )}
      />

      {items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Film className="size-7 mx-auto mb-2 opacity-50" />
          Belum ada adegan. Tambah adegan pertama untuk mula membina papan cerita.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((scene) => (
                <SceneRow
                  key={scene.id}
                  scene={scene}
                  projectId={projectId}
                  canWrite={canWrite}
                  canAI={canAI}
                  index={items.findIndex((s) => s.id === scene.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddSceneDialog open={addOpen} onOpenChange={setAddOpen}
        onSubmit={(b) => createMut.mutate(b)} loading={createMut.isPending} />
    </section>
  );
}

function SceneRow({
  scene, projectId, canWrite, canAI, index,
}: {
  scene: VideoSceneT; projectId: string; canWrite: boolean; canAI: boolean; index: number;
}) {
  const qc = useQueryClient();
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: scene.id, disabled: !canWrite });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const [title, setTitle] = useState(scene.title);
  const [description, setDescription] = useState(scene.description);
  const [visualPrompt, setVisualPrompt] = useState(scene.visualPrompt ?? "");
  const [notes, setNotes] = useState(scene.notes ?? "");
  const [duration, setDuration] = useState(scene.durationSec ?? 10);
  const [aiLoading, setAiLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  useEffect(() => {
    setTitle(scene.title);
    setDescription(scene.description);
    setVisualPrompt(scene.visualPrompt ?? "");
    setNotes(scene.notes ?? "");
    setDuration(scene.durationSec ?? 10);
  }, [scene]);

  const dirty =
    title !== scene.title ||
    description !== scene.description ||
    visualPrompt !== (scene.visualPrompt ?? "") ||
    notes !== (scene.notes ?? "") ||
    duration !== (scene.durationSec ?? 10);

  async function saveScene() {
    setSaveLoading(true);
    try {
      const r = await fetch(`/api/video-scenes/${scene.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, visualPrompt: visualPrompt || null,
          notes: notes || null, durationSec: duration,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Gagal menyimpan adegan");
      }
      toast.success(`Adegan ${index + 1} disimpan`);
      qc.invalidateQueries({ queryKey: ["video-project", projectId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaveLoading(false);
    }
  }

  async function delScene() {
    try {
      const r = await fetch(`/api/video-scenes/${scene.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Gagal memadam adegan");
      toast.success("Adegan dipadam");
      qc.invalidateQueries({ queryKey: ["video-project", projectId] });
      setDelOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function generateVisual() {
    if (!canAI) { toast.error("Anda tiada kebenaran untuk penjanaan AI"); return; }
    if (!description.trim()) { toast.error("Isi deskripsi adegan dahulu"); return; }
    setAiLoading(true);
    try {
      const r = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "video_visual",
          prompt: description,
          context: { sceneDescription: description },
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Gagal menjana prompt visual");
      }
      const data = await r.json();
      setVisualPrompt(data.content ?? "");
      toast.success("Prompt visual dijana", { description: `${data.tokensUsed ?? 0} token` });
    } catch (e) {
      toast.error("Gagal menjana prompt visual", { description: (e as Error).message });
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div ref={setNodeRef} style={style}
      className={cn(
        "glass-dark p-4 sm:p-5 space-y-3",
        isDragging && "ring-2 ring-gold/50"
      )}>
      <div className="flex items-center gap-2 flex-wrap">
        {canWrite && (
          <button {...attributes} {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none p-1"
            aria-label="Seret untuk susun semula">
            <GripVertical className="size-4" />
          </button>
        )}
        <span className="inline-flex items-center justify-center size-7 rounded-lg bg-gold/20 border border-gold/40 text-gold text-xs font-bold">
          {index + 1}
        </span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} readOnly={!canWrite}
          className="bg-white/8 border-white/15 font-semibold flex-1 min-w-0" />
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          <Input type="number" min={1} max={600} value={duration}
            onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
            disabled={!canWrite}
            className="bg-white/8 border-white/15 w-16 h-7 text-center" />
          <span className="ml-1 font-mono">({formatDurationSec(duration)})</span>
        </div>
        {canWrite && (
          <Button size="icon" variant="ghost" onClick={() => setDelOpen(true)}
            className="text-red-300 hover:bg-red-500/15 hover:text-red-200 size-8">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} readOnly={!canWrite}
        placeholder="Huraian adegan (apa yang berlaku)…"
        className="bg-white/8 border-white/15 min-h-20 text-sm" />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label className="text-[11px] uppercase tracking-wider text-teal-soft">Prompt Visual AI</Label>
          <AiButton onClick={generateVisual} loading={aiLoading} disabled={!canWrite || !canAI} size="sm">
            Janakan Prompt Visual
          </AiButton>
        </div>
        <Textarea value={visualPrompt} onChange={(e) => setVisualPrompt(e.target.value)} readOnly={!canWrite}
          placeholder="Prompt visual terperinci untuk alat penjanaan imej/video AI…"
          className="bg-white/8 border-white/15 min-h-24 font-mono text-[11px] leading-relaxed text-teal-soft/90" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nota Produksi</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} readOnly={!canWrite}
          placeholder="Nota tambahan untuk pasukan produksi…"
          className="bg-white/8 border-white/15 min-h-12 text-xs" />
      </div>

      {canWrite && (
        <div className="flex justify-end pt-1">
          <Button onClick={saveScene} disabled={saveLoading || !dirty} size="sm"
            className="bg-teal hover:bg-teal/80 text-white">
            {saveLoading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Simpan Adegan
          </Button>
        </div>
      )}

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent className="glass-strong border-white/25 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Padam adegan ini?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Adegan {index + 1}: {scene.title}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/20">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={delScene}
              className="bg-destructive text-white hover:bg-destructive/90">
              <Trash2 className="size-4" /> Padam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddSceneDialog({
  open, onOpenChange, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (b: { title: string; description: string; durationSec?: number; notes?: string }) => void;
  loading: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(10);
  const [notes, setNotes] = useState("");

  function handleOpenChange(o: boolean) {
    if (!o) { setTitle(""); setDescription(""); setDuration(10); setNotes(""); }
    onOpenChange(o);
  }

  function submit() {
    if (!title.trim() || !description.trim()) {
      toast.error("Tajuk dan deskripsi diperlukan");
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      durationSec: Math.max(1, duration),
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass-strong border-white/25 text-foreground max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Adegan Baharu</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Tambah adegan ke papan cerita. Prompt visual boleh dijana selepas ini.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tajuk Adegan *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="cth: Pembukaan — bendera berkibar"
              className="bg-white/8 border-white/20" />
          </div>
          <div className="space-y-1.5">
            <Label>Deskripsi *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Apa yang berlaku dalam adegan ini…"
              className="bg-white/8 border-white/20 min-h-20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Durasi (saat)</Label>
              <Input type="number" min={1} max={600} value={duration}
                onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
                className="bg-white/8 border-white/20" />
            </div>
            <div className="space-y-1.5">
              <Label>Nota (pilihan)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)}
                className="bg-white/8 border-white/20" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost" className="text-foreground/80">Batal</Button></DialogClose>
          <Button onClick={submit} disabled={loading}
            className="bg-gradient-to-r from-teal to-teal-soft text-white">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Tambah Adegan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Card: Media Assets
// ============================================================

const ASSET_ICON: Record<string, typeof ImageIcon> = {
  image: ImageIcon, video: Film, audio: Music,
  logo: Sparkles, document: FileText,
};

function AssetsCard({
  projectId, assets, canWrite,
}: { projectId: string; assets: VideoAssetT[]; canWrite: boolean }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const createMut = useMutation({
    mutationFn: async (body: { fileName: string; fileUrl: string; assetType: string; fileSize?: number }) => {
      const r = await fetch("/api/video-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...body }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Gagal memuat naik aset");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Aset ditambah");
      qc.invalidateQueries({ queryKey: ["video-project", projectId] });
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/video-assets/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Gagal memadam aset");
    },
    onSuccess: () => {
      toast.success("Aset dipadam");
      qc.invalidateQueries({ queryKey: ["video-project", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="glass p-5 animate-glass-in">
      <CardHeader
        icon={<Upload className="size-5" />}
        title="Aset Media"
        subtitle={`${assets.length} aset`}
        action={canWrite && (
          <Button onClick={() => setAddOpen(true)} size="sm" variant="outline"
            className="bg-white/5 border-white/20 text-foreground hover:bg-white/10">
            <Upload className="size-4" /> Muat Naik
          </Button>
        )}
      />
      {assets.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Tiada aset. Tambah pautan fail untuk logo, muzik, atau imej rujukan.
        </p>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto scroll-glass pr-1">
          {assets.map((a) => {
            const Icon = ASSET_ICON[a.assetType] ?? FileText;
            return (
              <li key={a.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-white/5 hover:bg-white/8 transition-colors">
                <div className="size-8 rounded-lg bg-teal/15 border border-teal/30 flex items-center justify-center text-teal-soft shrink-0">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground truncate">{a.fileName}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {a.assetType} · {formatFileSize(a.fileSize)} · {relativeTime(a.createdAt)}
                  </div>
                </div>
                {canWrite && (
                  <Button size="icon" variant="ghost" onClick={() => delMut.mutate(a.id)}
                    className="text-red-300 hover:bg-red-500/15 hover:text-red-200 size-7">
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AddAssetDialog open={addOpen} onOpenChange={setAddOpen}
        onSubmit={(b) => createMut.mutate(b)} loading={createMut.isPending} />
    </section>
  );
}

function AddAssetDialog({
  open, onOpenChange, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (b: { fileName: string; fileUrl: string; assetType: string; fileSize?: number }) => void;
  loading: boolean;
}) {
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [assetType, setAssetType] = useState("image");
  const [fileSize, setFileSize] = useState<number | "">("");

  function handleOpenChange(o: boolean) {
    if (!o) { setFileName(""); setFileUrl(""); setAssetType("image"); setFileSize(""); }
    onOpenChange(o);
  }

  function submit() {
    if (!fileName.trim() || !fileUrl.trim()) {
      toast.error("Nama fail dan URL diperlukan");
      return;
    }
    onSubmit({
      fileName: fileName.trim(),
      fileUrl: fileUrl.trim(),
      assetType,
      fileSize: typeof fileSize === "number" ? fileSize : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass-strong border-white/25 text-foreground max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Tambah Aset Media</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Rekod metadata aset. Untuk demo, tiada muat naik fail sebenar — gunakan URL sedia ada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nama Fail *</Label>
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)}
              placeholder="cth: logo-jtm-2026.png"
              className="bg-white/8 border-white/20" />
          </div>
          <div className="space-y-1.5">
            <Label>URL Fail *</Label>
            <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://…"
              className="bg-white/8 border-white/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Jenis Aset</Label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger className="bg-white/8 border-white/20 w-full"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-dark border-white/20">
                  <SelectItem value="image">Imej</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="logo">Logo</SelectItem>
                  <SelectItem value="document">Dokumen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Saiz (byte)</Label>
              <Input type="number" min={0} value={fileSize}
                onChange={(e) => setFileSize(e.target.value ? Number(e.target.value) : "")}
                placeholder="cth: 1048576"
                className="bg-white/8 border-white/20" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost" className="text-foreground/80">Batal</Button></DialogClose>
          <Button onClick={submit} disabled={loading}
            className="bg-gradient-to-r from-teal to-teal-soft text-white">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Tambah Aset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Card: Approvals
// ============================================================

function ApprovalsCard({
  projectId, approvals, canApprove, projectStatus,
}: {
  projectId: string;
  approvals: VideoApprovalT[];
  canApprove: boolean;
  projectStatus: string;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"approved" | "rejected" | "changes_requested">("approved");
  const [comment, setComment] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/video-projects/${projectId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment: comment.trim() || undefined }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Gagal menghantar kelulusan");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Kelulusan direkod");
      qc.invalidateQueries({ queryKey: ["video-project", projectId] });
      qc.invalidateQueries({ queryKey: ["video-projects"] });
      setComment("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="glass p-5 animate-glass-in">
      <CardHeader
        icon={<ShieldCheck className="size-5" />}
        title="Kelulusan"
        subtitle={`${approvals.length} rekod`}
      />

      {approvals.length > 0 && (
        <ul className="space-y-2.5 max-h-64 overflow-y-auto scroll-glass pr-1 mb-4">
          {approvals.map((a) => {
            const meta = APPROVAL_META[a.status] ?? { label: a.status, pill: "pill-pending" };
            return (
              <li key={a.id} className="p-2.5 rounded-lg bg-white/5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-foreground truncate">
                    {a.reviewer?.name ?? "Sistem"}
                  </span>
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium", meta.pill)}>
                    {meta.label}
                  </span>
                </div>
                {a.comment && (
                  <p className="text-[11px] text-muted-foreground italic leading-relaxed mb-1">
                    “{a.comment}”
                  </p>
                )}
                <div className="text-[10px] text-muted-foreground">
                  {a.reviewedAt ? formatDateTime(a.reviewedAt) : relativeTime(a.createdAt)}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canApprove && projectStatus !== "approved" ? (
        <div className="space-y-3 pt-3 border-t border-white/10">
          <div className="text-[11px] uppercase tracking-wider text-gold/90">Borang Kelulusan</div>
          <div className="space-y-1.5">
            <Label className="text-xs">Keputusan</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="bg-white/8 border-white/20 w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-dark border-white/20">
                <SelectItem value="approved">Lulus</SelectItem>
                <SelectItem value="changes_requested">Minta Perubahan</SelectItem>
                <SelectItem value="rejected">Tolak</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Komen</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Ulasan untuk pasukan kreatif…"
              className="bg-white/8 border-white/20 min-h-16 text-xs" />
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="w-full bg-gradient-to-r from-teal to-teal-soft text-white">
            {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Hantar Kelulusan
          </Button>
        </div>
      ) : projectStatus === "approved" && (
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-emerald-300">
          <Check className="size-4" /> Projek telah diluluskan.
        </div>
      )}
    </section>
  );
}

function ApprovalQuickActions({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState<null | "approved" | "rejected" | "changes_requested">(null);

  const mut = useMutation({
    mutationFn: async (status: "approved" | "rejected" | "changes_requested") => {
      const r = await fetch(`/api/video-projects/${projectId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment: comment.trim() || undefined }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Gagal");
      }
    },
    onSuccess: () => {
      toast.success("Kelulusan direkod");
      qc.invalidateQueries({ queryKey: ["video-project", projectId] });
      qc.invalidateQueries({ queryKey: ["video-projects"] });
      setComment(""); setOpen(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => mut.mutate("approved")} disabled={mut.isPending}
        className="bg-emerald-600/80 hover:bg-emerald-600 text-white">
        {mut.isPending && open === "approved" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Luluskan
      </Button>
      <Button size="sm" variant="outline"
        onClick={() => setOpen("changes_requested")}
        disabled={mut.isPending}
        className="bg-gold/15 border-gold/40 text-gold hover:bg-gold/25">
        <AlertCircle className="size-4" /> Minta Perubahan
      </Button>
      <Button size="sm" variant="outline"
        onClick={() => setOpen("rejected")}
        disabled={mut.isPending}
        className="bg-red-500/10 border-red-500/40 text-red-300 hover:bg-red-500/20">
        <X className="size-4" /> Tolak
      </Button>

      <Dialog open={open !== null} onOpenChange={(o) => { if (!o) setOpen(null); }}>
        <DialogContent className="glass-strong border-white/25 text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {open === "rejected" ? "Tolak Projek" : "Minta Perubahan"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Tambah ulasan untuk pasukan kreatif.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Ulasan…"
            className="bg-white/8 border-white/20 min-h-20 text-sm" />
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" className="text-foreground/80">Batal</Button></DialogClose>
            <Button
              onClick={() => open && mut.mutate(open)}
              disabled={mut.isPending}
              className={cn(
                open === "rejected"
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : "bg-gold text-background hover:bg-gold/90"
              )}>
              {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Hantar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Card: Export
// ============================================================

function ExportCard({
  projectId, sceneCount, totalDuration, assetCount,
}: {
  projectId: string; sceneCount: number; totalDuration: number; assetCount: number;
}) {
  const [loading, setLoading] = useState(false);

  async function exportPkg() {
    setLoading(true);
    try {
      const r = await fetch(`/api/video-projects/${projectId}/export`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Gagal mengeksport");
      }
      const data = await r.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = (data?.project?.title ?? "video-project")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      a.download = `${safeTitle}-produksi.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Spesifikasi produksi dieksport", { description: `${sceneCount} adegan · ${assetCount} aset` });
    } catch (e) {
      toast.error("Gagal mengeksport", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="glass p-5 animate-glass-in">
      <CardHeader
        icon={<Download className="size-5" />}
        title="Eksport Produksi"
        subtitle="Spesifikasi JSON lengkap untuk pasukan produksi."
      />
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2.5 rounded-lg bg-white/5">
          <div className="text-lg font-display font-bold text-teal-soft">{sceneCount}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Adegan</div>
        </div>
        <div className="text-center p-2.5 rounded-lg bg-white/5">
          <div className="text-lg font-display font-bold text-gold">{formatDurationSec(totalDuration)}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Jumlah</div>
        </div>
        <div className="text-center p-2.5 rounded-lg bg-white/5">
          <div className="text-lg font-display font-bold text-foreground">{assetCount}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Aset</div>
        </div>
      </div>
      <Button onClick={exportPkg} disabled={loading}
        className="w-full bg-gradient-to-r from-gold to-amber-500 text-background hover:brightness-110">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        Eksport Spesifikasi Produksi
      </Button>
    </section>
  );
}

// ============================================================
// Shared: Card header
// ============================================================

function CardHeader({
  icon, title, subtitle, action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="shrink-0 size-10 rounded-xl bg-teal/20 border border-teal/35 flex items-center justify-center text-teal-soft">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-base text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
