"use client";

/**
 * SIRI-AI JTM — Modul 2: Dashboard Operasi (PRD §7)
 *
 * Komposisi:
 *  - StatBar (4 kad statistik) — §7.1
 *  - KanbanBoard (Work Planning) + drag-and-drop — §7.2
 *  - MeetingsWidget (akan datang + lepas) — §7.3
 *  - KeyTasksPanel (KPI Tracker) — §7.4
 *  - BulletinFeed (pengumuman & buletin) — §7.5
 *
 * Data: TanStack Query + fetch /api/{tasks,meetings,key-tasks,bulletins,users}.
 * RBAC: canPerform(...) dari @/lib/security.
 */

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ClipboardList,
  CalendarDays,
  AlertTriangle,
  Megaphone,
  Plus,
  Pin,
  MoreVertical,
  Trash2,
  Archive,
  MapPin,
  Video,
  Users,
  CalendarClock,
  Target,
  Flag,
  Filter,
  ChevronDown,
  Loader2,
  CheckCircle2,
  Circle,
} from "lucide-react";

import { StatCard } from "@/components/glass/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { canPerform } from "@/lib/security";
import {
  formatDate,
  formatDateTime,
  formatRelative,
  initials,
  priorityLabel,
  keyTaskStatusLabel,
  categoryColor,
  dueRelative,
  toDateInput,
} from "@/lib/format";
import type {
  TaskT,
  MeetingT,
  KeyTaskT,
  BulletinT,
  UserT,
} from "@/lib/store";

// ============================================================
// Constants & meta maps
// ============================================================

const TASK_COLUMNS: { status: string; label: string; pill: string; bar: string }[] = [
  { status: "todo", label: "Belum Mula", pill: "pill-todo", bar: "bg-slate-400" },
  { status: "in_progress", label: "Dalam Tindakan", pill: "pill-in-progress", bar: "bg-teal" },
  { status: "review", label: "Semakan", pill: "pill-review", bar: "bg-gold" },
  { status: "done", label: "Selesai", pill: "pill-done", bar: "bg-emerald-500" },
];

const UNITS = ["Pengurusan", "Latihan", "Kreatif", "Unit ICT"];

const BULLETIN_CATEGORIES = [
  "Pengumuman Rasmi",
  "Acara/Aktiviti",
  "Notis Pentadbiran",
  "Perayaan/Kemerdekaan",
];

const KEYTASK_STATUSES = [
  { value: "on_track", label: "On Track", pill: "pill-on-track" },
  { value: "at_risk", label: "Berisiko", pill: "pill-at-risk" },
  { value: "delayed", label: "Tertangguh", pill: "pill-delayed" },
  { value: "completed", label: "Selesai", pill: "pill-done" },
];

const PRIORITY_PILL: Record<string, string> = {
  high: "pill-high",
  medium: "pill-medium",
  low: "pill-low",
};

// ============================================================
// API fetchers
// ============================================================

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Ralat ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* noop */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

function fetcher<T>(url: string): () => Promise<T> {
  return () => fetch(url).then((r) => jsonOrThrow<T>(r));
}

// ============================================================
// GlassModal — Dialog + glass-strong surface
// ============================================================

function GlassModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "glass-strong border-white/25 text-foreground max-h-[90vh] overflow-y-auto scroll-glass",
          maxWidth
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-gradient-gold text-xl font-display">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        {open && children}
        {footer && <DialogFooter className="mt-2">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Avatar helper
// ============================================================

function UserAvatar({ name, size = "size-7" }: { name?: string | null; size?: string }) {
  return (
    <Avatar className={size}>
      <AvatarFallback className="bg-teal/30 border border-teal/40 text-teal-soft text-[11px] font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

// ============================================================
// SECTION A — StatBar
// ============================================================

function StatBar({
  tasks,
  meetings,
  keyTasks,
  bulletins,
}: {
  tasks: TaskT[];
  meetings: MeetingT[];
  keyTasks: KeyTaskT[];
  bulletins: BulletinT[];
}) {
  const now = Date.now();
  const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const activeTasks = tasks.filter((t) => t.status !== "done").length;
  const meetingsThisWeek = meetings.filter((m) => {
    const s = new Date(m.startsAt).getTime();
    return s >= now && s <= weekAhead;
  }).length;
  const delayedKeyTasks = keyTasks.filter((t) =>
    ["delayed", "at_risk"].includes(t.status)
  ).length;
  const newBulletins = bulletins.filter(
    (b) => new Date(b.publishedAt).getTime() >= weekAgo || b.pinned
  ).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      <StatCard
        label="Tugasan Aktif"
        value={activeTasks}
        icon={<ClipboardList className="size-5" />}
        hint="Tugasan belum selesai"
        accent="teal"
        trend={activeTasks > 0 ? `${activeTasks} item` : "Kosong"}
        trendDirection="neutral"
      />
      <StatCard
        label="Mesyuarat Minggu Ini"
        value={meetingsThisWeek}
        icon={<CalendarDays className="size-5" />}
        hint="7 hari akan datang"
        accent="gold"
        trend={meetingsThisWeek > 0 ? "Aktif" : "Tiada"}
        trendDirection={meetingsThisWeek > 0 ? "up" : "neutral"}
      />
      <StatCard
        label="Kerja Utama Tertunggak"
        value={delayedKeyTasks}
        icon={<AlertTriangle className="size-5" />}
        hint="Berisiko / tertangguh"
        accent="red"
        trend={delayedKeyTasks > 0 ? "Perlu tindakan" : "Selamat"}
        trendDirection={delayedKeyTasks > 0 ? "down" : "up"}
      />
      <StatCard
        label="Pengumuman Baharu"
        value={newBulletins}
        icon={<Megaphone className="size-5" />}
        hint="7 hari lepas / disemat"
        accent="green"
        trend={newBulletins > 0 ? "Tersedia" : "Tiada"}
        trendDirection={newBulletins > 0 ? "up" : "neutral"}
      />
    </div>
  );
}

// ============================================================
// SECTION B — Kanban Board (Work Planning)
// ============================================================

function KanbanCardView({ task }: { task: TaskT }) {
  const due = dueRelative(task.dueDate);
  const overdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== "done";
  return (
    <div className="glass glass-hover p-3 rounded-xl flex flex-col gap-2 cursor-pointer">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-foreground leading-snug line-clamp-2">
          {task.title}
        </h4>
        <span
          className={cn(
            "shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium",
            PRIORITY_PILL[task.priority] ?? "pill-medium"
          )}
        >
          {priorityLabel(task.priority)}
        </span>
      </div>
      {task.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2">
          {task.description}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Progress
          value={task.progress}
          className="h-1.5 bg-white/10"
        />
        <span className="text-[10px] text-muted-foreground shrink-0">{task.progress}%</span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <UserAvatar name={task.assignee?.name} size="size-6" />
        {due && (
          <span
            className={cn(
              "text-[10px] font-medium",
              overdue ? "text-red-300" : "text-muted-foreground"
            )}
          >
            {due}
          </span>
        )}
      </div>
    </div>
  );
}

function SortableKanbanCard({
  task,
  onClick,
}: {
  task: TaskT;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Only fire click when not dragging
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
      className="touch-none"
    >
      <KanbanCardView task={task} />
    </div>
  );
}

function KanbanColumn({
  status,
  label,
  pill,
  bar,
  tasks,
  onCardClick,
}: {
  status: string;
  label: string;
  pill: string;
  bar: string;
  tasks: TaskT[];
  onCardClick: (t: TaskT) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-2 p-2.5 rounded-2xl border border-white/10 bg-white/[0.03] min-h-[160px] transition-colors",
        isOver && "border-teal/50 bg-teal/10"
      )}
    >
      <div className="flex items-center gap-2 px-1">
        <span className={cn("w-1 h-5 rounded-full", bar)} />
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span
          className={cn(
            "ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium",
            pill
          )}
        >
          {tasks.length}
        </span>
      </div>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {tasks.length === 0 && (
            <div className="text-[11px] text-muted-foreground/60 italic text-center py-6">
              Tiada tugasan
            </div>
          )}
          {tasks.map((t) => (
            <SortableKanbanCard
              key={t.id}
              task={t}
              onClick={() => onCardClick(t)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// --- Task form (create/edit) ---

function TaskFormBody({
  initial,
  users,
  onCancel,
  onSubmit,
  submitting,
}: {
  initial: Partial<TaskT> | null;
  users: UserT[];
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [status, setStatus] = useState(initial?.status ?? "todo");
  const [unit, setUnit] = useState(initial?.unit ?? "all");
  const [assigneeId, setAssigneeId] = useState(initial?.assigneeId ?? "__none__");
  const [dueDate, setDueDate] = useState(toDateInput(initial?.dueDate));
  const [progress, setProgress] = useState(initial?.progress ?? 0);

  function submit() {
    if (!title.trim()) {
      toast.error("Sila isi tajuk tugasan");
      return;
    }
    const data: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status,
      unit: unit === "all" ? undefined : unit,
      assigneeId: assigneeId === "__none__" ? undefined : assigneeId,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      progress: Number(progress) || 0,
    };
    onSubmit(data);
  }

  return (
    <div className="grid gap-3 py-1">
      <div className="grid gap-1.5">
        <Label htmlFor="task-title">Tajuk</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="cth. Sediakan laporan mingguan"
          autoFocus
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="task-desc">Penerangan</Label>
        <Textarea
          id="task-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Butiran tugasan…"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Keutamaan</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">Tinggi</SelectItem>
              <SelectItem value="medium">Sederhana</SelectItem>
              <SelectItem value="low">Rendah</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_COLUMNS.map((c) => (
                <SelectItem key={c.status} value={c.status}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Unit</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua unit</SelectItem>
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="task-due">Tamat Tempoh</Label>
          <Input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Penanggung Jawab</Label>
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="— Tidak ditugaskan —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Tidak ditugaskan —</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name} · {u.unit ?? "—"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label>Kemajuan</Label>
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
        <Slider
          value={[progress]}
          min={0}
          max={100}
          step={5}
          onValueChange={(v) => setProgress(v[0])}
        />
      </div>
      <div className="flex justify-end gap-2 mt-1">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {initial?.id ? "Simpan" : "Cipta"}
        </Button>
      </div>
    </div>
  );
}

function KanbanBoard({
  tasks,
  users,
  canEdit,
}: {
  tasks: TaskT[];
  users: UserT[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskT | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<TaskT | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const filtered = useMemo(
    () => (unitFilter === "all" ? tasks : tasks.filter((t) => t.unit === unitFilter)),
    [tasks, unitFilter]
  );

  const byStatus = useMemo(() => {
    const map: Record<string, TaskT[]> = {};
    for (const c of TASK_COLUMNS) map[c.status] = [];
    for (const t of filtered) {
      const s = map[t.status] ?? map.todo;
      s.push(t);
    }
    return map;
  }, [filtered]);

  const patchTask = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => {
      const r = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return jsonOrThrow<{ task: TaskT }>(r);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const prev = queryClient.getQueryData<{ tasks: TaskT[] }>(["tasks"]);
      if (prev?.tasks) {
        const next = prev.tasks.map((t) =>
          t.id === id ? { ...t, ...data } : t
        );
        queryClient.setQueryData<{ tasks: TaskT[] }>(["tasks"], { tasks: next });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["tasks"], ctx.prev);
      toast.error("Gagal mengemaskini tugasan");
    },
    onSuccess: () => {
      toast.success("Tugasan dikemaskini");
    },
  });

  const createTask = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return jsonOrThrow<{ task: TaskT }>(r);
    },
    onSuccess: () => {
      toast.success("Tugasan dicipta");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    const t = tasks.find((x) => x.id === e.active.id);
    setActiveTask(t ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const overId = String(over.id);

    let newStatus: string | null = null;
    if (overId.startsWith("col-")) {
      newStatus = overId.slice(4);
    } else {
      // overId is a task id — find which column it lives in
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) newStatus = overTask.status;
    }
    if (!newStatus) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    patchTask.mutate({ id: taskId, data: { status: newStatus } });
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(t: TaskT) {
    setEditing(t);
    setFormOpen(true);
  }

  function submitForm(data: Record<string, unknown>) {
    if (editing) {
      patchTask.mutate(
        { id: editing.id, data },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditing(null);
          },
        }
      );
    } else {
      createTask.mutate(data);
    }
  }

  return (
    <section className="glass p-4 sm:p-5 animate-glass-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-teal/20 border border-teal/35 flex items-center justify-center text-teal-soft">
            <ClipboardList className="size-4" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base sm:text-lg text-foreground">
              Perancangan Kerja
            </h3>
            <p className="text-xs text-muted-foreground">
              Seret kad untuk mengubah status
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="size-3.5 text-muted-foreground" />
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger size="sm" className="h-8 w-[140px]">
                <SelectValue placeholder="Semua Unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Unit</SelectItem>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canEdit && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" /> Tugasan Baharu
            </Button>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {TASK_COLUMNS.map((c) => (
            <KanbanColumn
              key={c.status}
              status={c.status}
              label={c.label}
              pill={c.pill}
              bar={c.bar}
              tasks={byStatus[c.status] ?? []}
              onCardClick={openEdit}
            />
          ))}
        </div>
        <DragOverlay>
          {activeId && activeTask ? (
            <div className="opacity-90 rotate-2">
              <KanbanCardView task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <GlassModal
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        title={editing ? "Edit Tugasan" : "Tugasan Baharu"}
        description="Isi butiran tugasan dan tetapkan penanggung jawab"
      >
        <TaskFormBody
          initial={editing}
          users={users}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={submitForm}
          submitting={patchTask.isPending || createTask.isPending}
        />
      </GlassModal>
    </section>
  );
}

// ============================================================
// SECTION C — Key Tasks Panel (KPI Tracker)
// ============================================================

function KeyTaskFormBody({
  initial,
  users,
  onCancel,
  onSubmit,
  submitting,
}: {
  initial: Partial<KeyTaskT> | null;
  users: UserT[];
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [target, setTarget] = useState(initial?.target ?? "");
  const [kpi, setKpi] = useState(initial?.kpi ?? "");
  const [achievementPct, setAchievementPct] = useState(initial?.achievementPct ?? 0);
  const [unit, setUnit] = useState(initial?.unit ?? "all");
  const [status, setStatus] = useState(initial?.status ?? "on_track");
  const [dueDate, setDueDate] = useState(toDateInput(initial?.dueDate));
  const [ownerId, setOwnerId] = useState(initial?.owner?.id ?? "__none__");

  function submit() {
    if (!title.trim()) {
      toast.error("Sila isi tajuk kerja utama");
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      target: target.trim() || undefined,
      kpi: kpi.trim() || undefined,
      achievementPct: Number(achievementPct) || 0,
      unit: unit === "all" ? undefined : unit,
      status,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      ownerId: ownerId === "__none__" ? undefined : ownerId,
    });
  }

  return (
    <div className="grid gap-3 py-1">
      <div className="grid gap-1.5">
        <Label htmlFor="kt-title">Tajuk</Label>
        <Input
          id="kt-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="cth. Penghantaran Laporan KPI Suku Tahunan"
          autoFocus
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="kt-desc">Penerangan</Label>
        <Textarea
          id="kt-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="kt-target">Sasaran</Label>
          <Input
            id="kt-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="cth. 100% laporan dihantar"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="kt-kpi">KPI</Label>
          <Input
            id="kt-kpi"
            value={kpi}
            onChange={(e) => setKpi(e.target.value)}
            placeholder="cth. ≥ 90%"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Unit</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua unit</SelectItem>
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KEYTASK_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="kt-due">Tamat Tempoh</Label>
          <Input
            id="kt-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Pemilik</Label>
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} · {u.unit ?? "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label>Pencapaian (%)</Label>
          <span className="text-xs text-muted-foreground">{achievementPct}%</span>
        </div>
        <Slider
          value={[achievementPct]}
          min={0}
          max={100}
          step={5}
          onValueChange={(v) => setAchievementPct(v[0])}
        />
      </div>
      <div className="flex justify-end gap-2 mt-1">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {initial?.id ? "Simpan" : "Cipta"}
        </Button>
      </div>
    </div>
  );
}

function KeyTasksPanel({
  keyTasks,
  users,
  canEdit,
}: {
  keyTasks: KeyTaskT[];
  users: UserT[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KeyTaskT | null>(null);

  const saveMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id?: string;
      data: Record<string, unknown>;
    }) => {
      const url = id ? `/api/key-tasks/${id}` : "/api/key-tasks";
      const r = await fetch(url, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return jsonOrThrow<{ keyTask: KeyTaskT }>(r);
    },
    onSuccess: () => {
      toast.success(editing ? "Kerja utama dikemaskini" : "Kerja utama dicipta");
      queryClient.invalidateQueries({ queryKey: ["key-tasks"] });
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(data: Record<string, unknown>) {
    saveMutation.mutate({ id: editing?.id, data });
  }

  return (
    <section className="glass p-4 sm:p-5 animate-glass-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-gold/20 border border-gold/35 flex items-center justify-center text-gold">
            <Target className="size-4" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base sm:text-lg text-foreground">
              Kerja Utama (KPI)
            </h3>
            <p className="text-xs text-muted-foreground">
              Penjejakan pencapaian & status
            </p>
          </div>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> Kerja Utama Baharu
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 max-h-[28rem] overflow-y-auto scroll-glass pr-1">
        {keyTasks.length === 0 && (
          <div className="text-sm text-muted-foreground italic text-center py-8">
            Tiada kerja utama
          </div>
        )}
        {keyTasks.map((kt) => {
          const pill =
            KEYTASK_STATUSES.find((s) => s.value === kt.status)?.pill ??
            "pill-on-track";
          const due = dueRelative(kt.dueDate);
          return (
            <button
              key={kt.id}
              onClick={() => {
                if (!canEdit) return;
                setEditing(kt);
                setFormOpen(true);
              }}
              className="glass glass-hover p-3 rounded-xl text-left flex flex-col gap-2 disabled:cursor-default"
              disabled={!canEdit}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-foreground line-clamp-1">
                    {kt.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    <Users className="size-3" />
                    <span className="truncate">{kt.owner?.name ?? "—"}</span>
                    {kt.target && (
                      <>
                        <span>·</span>
                        <span className="truncate">{kt.target}</span>
                      </>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium",
                    pill
                  )}
                >
                  {keyTaskStatusLabel(kt.status)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Progress
                  value={kt.achievementPct}
                  className={cn(
                    "h-1.5 bg-white/10 flex-1",
                    kt.achievementPct >= 70
                      ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
                      : kt.achievementPct >= 40
                        ? "[&_[data-slot=progress-indicator]]:bg-gold"
                        : "[&_[data-slot=progress-indicator]]:bg-red-500"
                  )}
                />
                <span className="text-[11px] font-medium text-foreground shrink-0">
                  {kt.achievementPct}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                {kt.kpi ? (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Flag className="size-3" /> KPI: {kt.kpi}
                  </span>
                ) : (
                  <span />
                )}
                {due && (
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      kt.status === "delayed"
                        ? "text-red-300"
                        : "text-muted-foreground"
                    )}
                  >
                    {due}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <GlassModal
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        title={editing ? "Edit Kerja Utama" : "Kerja Utama Baharu"}
        description="Tetapkan sasaran, KPI dan pencapaian semasa"
      >
        <KeyTaskFormBody
          initial={editing}
          users={users}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={submit}
          submitting={saveMutation.isPending}
        />
      </GlassModal>
    </section>
  );
}

// ============================================================
// SECTION D — Meetings Widget
// ============================================================

function MeetingFormBody({
  users,
  onCancel,
  onSubmit,
  submitting,
}: {
  users: UserT[];
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [agenda, setAgenda] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  function toggleParticipant(id: string) {
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function submit() {
    if (!title.trim()) {
      toast.error("Sila isi tajuk mesyuarat");
      return;
    }
    if (!startsAt) {
      toast.error("Sila tetapkan tarikh & masa mula");
      return;
    }
    onSubmit({
      title: title.trim(),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      location: location.trim() || undefined,
      meetingUrl: meetingUrl.trim() || undefined,
      agenda: agenda.trim() || undefined,
      participantIds,
    });
  }

  return (
    <div className="grid gap-3 py-1">
      <div className="grid gap-1.5">
        <Label htmlFor="m-title">Tajuk</Label>
        <Input
          id="m-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="cth. Mesyuarat Penilaian Hujang Bulan"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="m-start">Mula</Label>
          <Input
            id="m-start"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="m-end">Tamat</Label>
          <Input
            id="m-end"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="m-loc">Lokasi</Label>
          <Input
            id="m-loc"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Bilik Mesyuarat A"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="m-url">Pautan Online</Label>
          <Input
            id="m-url"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            placeholder="https://meet.jtm.gov.my/…"
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="m-agenda">Agenda</Label>
        <Textarea
          id="m-agenda"
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          rows={3}
          placeholder="1. ...\n2. ..."
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Peserta</Label>
        <div className="glass-dark rounded-xl p-2 max-h-40 overflow-y-auto scroll-glass grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {users.length === 0 && (
            <span className="text-xs text-muted-foreground italic px-2 py-1">
              Tiada pengguna
            </span>
          )}
          {users.map((u) => (
            <label
              key={u.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs"
            >
              <Checkbox
                checked={participantIds.includes(u.id)}
                onCheckedChange={() => toggleParticipant(u.id)}
              />
              <span className="text-foreground truncate">{u.name}</span>
              <span className="text-muted-foreground ml-auto text-[10px]">
                {u.unit ?? ""}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-1">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Cipta
        </Button>
      </div>
    </div>
  );
}

function MeetingDetailsBody({
  meeting,
  onCancel,
}: {
  meeting: MeetingT;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const toggleActionItem = useMutation({
    mutationFn: async ({
      id,
      completed,
    }: {
      id: string;
      completed: boolean;
    }) => {
      const r = await fetch(`/api/meeting-action-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      return jsonOrThrow<{ item: { id: string; completed: boolean } }>(r);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 py-1">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-muted-foreground">Mula</div>
          <div className="text-foreground font-medium">
            {formatDateTime(meeting.startsAt)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Tamat</div>
          <div className="text-foreground font-medium">
            {meeting.endsAt ? formatDateTime(meeting.endsAt) : "—"}
          </div>
        </div>
        {meeting.location && (
          <div className="flex items-center gap-1.5 col-span-2">
            <MapPin className="size-3.5 text-muted-foreground" />
            <span className="text-foreground">{meeting.location}</span>
          </div>
        )}
        {meeting.meetingUrl && (
          <div className="flex items-center gap-1.5 col-span-2">
            <Video className="size-3.5 text-muted-foreground" />
            <a
              href={meeting.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-teal-soft hover:underline truncate"
            >
              {meeting.meetingUrl}
            </a>
          </div>
        )}
      </div>
      {meeting.agenda && (
        <div className="glass-dark rounded-xl p-3">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">
            Agenda
          </div>
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">
            {meeting.agenda}
          </pre>
        </div>
      )}
      <div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">
          Peserta ({meeting.participants?.length ?? 0})
        </div>
        <div className="flex flex-wrap gap-2">
          {(meeting.participants ?? []).map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-1.5 glass-dark rounded-full pl-1 pr-3 py-1"
            >
              <UserAvatar name={p.user.name} size="size-5" />
              <span className="text-xs text-foreground">{p.user.name}</span>
            </div>
          ))}
          {(meeting.participants ?? []).length === 0 && (
            <span className="text-xs text-muted-foreground italic">
              Tiada peserta
            </span>
          )}
        </div>
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">
          Item Tindakan ({meeting.actionItems?.length ?? 0})
        </div>
        <div className="flex flex-col gap-1.5">
          {(meeting.actionItems ?? []).map((a) => (
            <button
              key={a.id}
              onClick={() =>
                toggleActionItem.mutate({
                  id: a.id,
                  completed: !a.completed,
                })
              }
              disabled={toggleActionItem.isPending}
              className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 text-left disabled:opacity-60"
            >
              {a.completed ? (
                <CheckCircle2 className="size-4 text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <Circle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-sm",
                    a.completed
                      ? "line-through text-muted-foreground"
                      : "text-foreground"
                  )}
                >
                  {a.title}
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                  {a.assignee && <span>{a.assignee.name}</span>}
                  {a.dueDate && (
                    <span className="flex items-center gap-1">
                      <CalendarClock className="size-3" />
                      {formatDate(a.dueDate)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
          {(meeting.actionItems ?? []).length === 0 && (
            <span className="text-xs text-muted-foreground italic">
              Tiada item tindakan
            </span>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onCancel}>
          Tutup
        </Button>
      </div>
    </div>
  );
}

function MeetingsWidget({
  meetings,
  users,
  canEdit,
}: {
  meetings: MeetingT[];
  users: UserT[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [detailMeeting, setDetailMeeting] = useState<MeetingT | null>(null);
  const [pastOpen, setPastOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const r = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return jsonOrThrow<{ meeting: MeetingT }>(r);
    },
    onSuccess: () => {
      toast.success("Mesyuarat dicipta");
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      setFormOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = Date.now();
  const upcoming = meetings
    .filter((m) => m.status === "scheduled" && new Date(m.startsAt).getTime() >= now)
    .slice(0, 5);
  const past = meetings
    .filter((m) => m.status === "completed" || new Date(m.startsAt).getTime() < now)
    .slice(0, 8);

  return (
    <section className="glass p-4 sm:p-5 animate-glass-in flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-teal/20 border border-teal/35 flex items-center justify-center text-teal-soft">
            <CalendarDays className="size-4" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base sm:text-lg text-foreground">
              Mesyuarat Akan Datang
            </h3>
            <p className="text-xs text-muted-foreground">
              {upcoming.length} mesyuarat akan datang
            </p>
          </div>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="size-4" /> Baharu
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 max-h-[26rem] overflow-y-auto scroll-glass pr-1">
        {upcoming.length === 0 && (
          <div className="text-sm text-muted-foreground italic text-center py-6">
            Tiada mesyuarat akan datang
          </div>
        )}
        {upcoming.map((m) => (
          <button
            key={m.id}
            onClick={() => setDetailMeeting(m)}
            className="glass glass-hover p-3 rounded-xl text-left flex flex-col gap-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-foreground line-clamp-1">
                {m.title}
              </h4>
              <Badge
                variant="outline"
                className="bg-teal/15 border-teal/30 text-teal-soft text-[10px] shrink-0"
              >
                <Users className="size-3" />
                {m.participants?.length ?? 0}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <CalendarClock className="size-3 text-gold" />
              <span>{formatDateTime(m.startsAt)}</span>
            </div>
            {m.location && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <MapPin className="size-3" />
                <span className="truncate">{m.location}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {past.length > 0 && (
        <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Mesyuarat Lalu ({past.length})</span>
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  pastOpen && "rotate-180"
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-2 mt-2 max-h-64 overflow-y-auto scroll-glass pr-1">
            {past.map((m) => (
              <button
                key={m.id}
                onClick={() => setDetailMeeting(m)}
                className="glass-dark p-2.5 rounded-lg text-left flex items-center justify-between gap-2 hover:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground line-clamp-1">
                    {m.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatDate(m.startsAt)}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    m.status === "completed"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 text-[10px]"
                      : "bg-white/10 border-white/20 text-muted-foreground text-[10px]"
                  }
                >
                  {m.status === "completed" ? "Selesai" : "Lepas"}
                </Badge>
              </button>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <GlassModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Mesyuarat Baharu"
        description="Tetapkan masa, lokasi dan peserta"
      >
        <MeetingFormBody
          users={users}
          onCancel={() => setFormOpen(false)}
          onSubmit={(d) => createMutation.mutate(d)}
          submitting={createMutation.isPending}
        />
      </GlassModal>

      <GlassModal
        open={detailMeeting !== null}
        onOpenChange={(o) => {
          if (!o) setDetailMeeting(null);
        }}
        title={detailMeeting?.title ?? ""}
        description="Butiran mesyuarat"
        maxWidth="max-w-xl"
      >
        {detailMeeting && (
          <MeetingDetailsBody
            meeting={detailMeeting}
            onCancel={() => setDetailMeeting(null)}
          />
        )}
      </GlassModal>
    </section>
  );
}

// ============================================================
// SECTION E — Bulletin Feed
// ============================================================

function BulletinFormBody({
  initial,
  onCancel,
  onSubmit,
  submitting,
}: {
  initial: Partial<BulletinT> | null;
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Pengumuman Rasmi");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [pinned, setPinned] = useState(initial?.pinned ?? false);

  function submit() {
    if (!title.trim()) {
      toast.error("Sila isi tajuk");
      return;
    }
    if (!body.trim()) {
      toast.error("Sila isi kandungan");
      return;
    }
    onSubmit({
      title: title.trim(),
      body: body.trim(),
      category,
      imageUrl: imageUrl.trim() || undefined,
      pinned,
    });
  }

  return (
    <div className="grid gap-3 py-1">
      <div className="grid gap-1.5">
        <Label htmlFor="b-title">Tajuk</Label>
        <Input
          id="b-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="cth. Sambutan Bulan Kemerdekaan"
          autoFocus
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Kategori</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BULLETIN_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="b-body">Kandungan</Label>
        <Textarea
          id="b-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Tulis pengumuman…"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="b-img">URL Gambar (pilihan)</Label>
        <Input
          id="b-img"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
        <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(Boolean(v))} />
        <span>Semat di atas (pinned)</span>
      </label>
      <div className="flex justify-end gap-2 mt-1">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {initial?.id ? "Simpan" : "Terbitkan"}
        </Button>
      </div>
    </div>
  );
}

function BulletinCard({
  bulletin,
  canEdit,
  canDelete,
  onClick,
}: {
  bulletin: BulletinT;
  canEdit: boolean;
  canDelete: boolean;
  onClick: () => void;
}) {
  const queryClient = useQueryClient();

  const pinMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/bulletins/${bulletin.id}/pin`, {
        method: "POST",
      });
      return jsonOrThrow<{ bulletin: BulletinT }>(r);
    },
    onSuccess: () => {
      toast.success(bulletin.pinned ? "Buang semat" : "Disemat");
      queryClient.invalidateQueries({ queryKey: ["bulletins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/bulletins/${bulletin.id}/archive`, {
        method: "POST",
      });
      return jsonOrThrow<{ ok: boolean }>(r);
    },
    onSuccess: () => {
      toast.success("Diarkibkan");
      queryClient.invalidateQueries({ queryKey: ["bulletins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/bulletins/${bulletin.id}`, {
        method: "DELETE",
      });
      return jsonOrThrow<{ ok: boolean }>(r);
    },
    onSuccess: () => {
      toast.success("Buletin dipadam");
      queryClient.invalidateQueries({ queryKey: ["bulletins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <article
      className={cn(
        "glass glass-hover p-3.5 rounded-xl flex flex-col gap-2 cursor-pointer",
        bulletin.pinned && "border-l-4 border-l-gold"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border font-medium",
              categoryColor(bulletin.category)
            )}
          >
            {bulletin.category}
          </span>
          {bulletin.pinned && (
            <span className="flex items-center gap-0.5 text-[10px] text-gold font-medium">
              <Pin className="size-3" /> Disemat
            </span>
          )}
        </div>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="size-7 rounded-md hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onClick={() => pinMutation.mutate()}>
                <Pin className="size-3.5" />
                {bulletin.pinned ? "Buang Semat" : "Semat"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => archiveMutation.mutate()}>
                <Archive className="size-3.5" />
                Arkib
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => deleteMutation.mutate()}
                    className="text-red-300 focus:text-red-200"
                  >
                    <Trash2 className="size-3.5" />
                    Padam
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
        {bulletin.title}
      </h4>
      <p className="text-xs text-muted-foreground line-clamp-3">{bulletin.body}</p>
      <div className="flex items-center justify-between gap-2 mt-1 pt-2 border-t border-white/10">
        <div className="flex items-center gap-1.5 min-w-0">
          <UserAvatar name={bulletin.creator?.name} size="size-5" />
          <span className="text-[11px] text-muted-foreground truncate">
            {bulletin.creator?.name ?? "Sistem"}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatRelative(bulletin.publishedAt)}
        </span>
      </div>
    </article>
  );
}

function BulletinFeed({
  bulletins,
  canEdit,
  canDelete,
}: {
  bulletins: BulletinT[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BulletinT | null>(null);

  const saveMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id?: string;
      data: Record<string, unknown>;
    }) => {
      const url = id ? `/api/bulletins/${id}` : "/api/bulletins";
      const r = await fetch(url, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return jsonOrThrow<{ bulletin: BulletinT }>(r);
    },
    onSuccess: () => {
      toast.success(editing ? "Buletin dikemaskini" : "Buletin diterbitkan");
      queryClient.invalidateQueries({ queryKey: ["bulletins"] });
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => (filter ? bulletins.filter((b) => b.category === filter) : bulletins),
    [bulletins, filter]
  );

  return (
    <section className="glass p-4 sm:p-5 animate-glass-in flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-emerald-500/20 border border-emerald-500/35 flex items-center justify-center text-emerald-300">
            <Megaphone className="size-4" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base sm:text-lg text-foreground">
              Buletin & Pengumuman
            </h3>
            <p className="text-xs text-muted-foreground">
              {filtered.length} entri
            </p>
          </div>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> Buletin Baharu
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter("")}
          className={cn(
            "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
            filter === ""
              ? "bg-teal/25 border-teal/45 text-teal-soft"
              : "bg-white/5 border-white/15 text-muted-foreground hover:text-foreground"
          )}
        >
          Semua
        </button>
        {BULLETIN_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
              filter === c
                ? "bg-teal/25 border-teal/45 text-teal-soft"
                : "bg-white/5 border-white/15 text-muted-foreground hover:text-foreground"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 max-h-[34rem] overflow-y-auto scroll-glass pr-1">
        {filtered.length === 0 && (
          <div className="text-sm text-muted-foreground italic text-center py-8">
            Tiada buletin
          </div>
        )}
        {filtered.map((b) => (
          <BulletinCard
            key={b.id}
            bulletin={b}
            canEdit={canEdit}
            canDelete={canDelete}
            onClick={() => {
              if (!canEdit) return;
              setEditing(b);
              setFormOpen(true);
            }}
          />
        ))}
      </div>

      <GlassModal
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        title={editing ? "Edit Buletin" : "Buletin Baharu"}
        description="Tulis dan terbitkan pengumuman"
        maxWidth="max-w-xl"
      >
        <BulletinFormBody
          initial={editing}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={(d) => saveMutation.mutate({ id: editing?.id, data: d })}
          submitting={saveMutation.isPending}
        />
      </GlassModal>
    </section>
  );
}

// ============================================================
// Root module
// ============================================================

export function DashboardModule() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const canEditTasks = canPerform("tasks", "write", role);
  const canEditMeetings = canPerform("meetings", "write", role);
  const canEditKeyTasks = canPerform("key_tasks", "write", role);
  const canEditBulletins = canPerform("bulletins", "write", role);
  const canDeleteBulletins = canPerform("bulletins", "delete", role);

  const tasksQ = useQuery<{ tasks: TaskT[] }>({
    queryKey: ["tasks"],
    queryFn: fetcher<{ tasks: TaskT[] }>("/api/tasks"),
  });
  const meetingsQ = useQuery<{ meetings: MeetingT[] }>({
    queryKey: ["meetings"],
    queryFn: fetcher<{ meetings: MeetingT[] }>("/api/meetings"),
  });
  const keyTasksQ = useQuery<{ keyTasks: KeyTaskT[] }>({
    queryKey: ["key-tasks"],
    queryFn: fetcher<{ keyTasks: KeyTaskT[] }>("/api/key-tasks"),
  });
  const bulletinsQ = useQuery<{ bulletins: BulletinT[] }>({
    queryKey: ["bulletins"],
    queryFn: fetcher<{ bulletins: BulletinT[] }>("/api/bulletins"),
  });
  const usersQ = useQuery<{ users: UserT[] }>({
    queryKey: ["users"],
    queryFn: fetcher<{ users: UserT[] }>("/api/users"),
  });

  const tasks = tasksQ.data?.tasks ?? [];
  const meetings = meetingsQ.data?.meetings ?? [];
  const keyTasks = keyTasksQ.data?.keyTasks ?? [];
  const bulletins = bulletinsQ.data?.bulletins ?? [];
  const users = usersQ.data?.users ?? [];

  const isLoading =
    tasksQ.isLoading ||
    meetingsQ.isLoading ||
    keyTasksQ.isLoading ||
    bulletinsQ.isLoading;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {isLoading && (
        <div className="glass p-3 rounded-xl flex items-center gap-2 text-sm text-muted-foreground animate-glass-in">
          <Loader2 className="size-4 animate-spin text-teal-soft" />
          Memuatkan data operasi…
        </div>
      )}

      <StatBar
        tasks={tasks}
        meetings={meetings}
        keyTasks={keyTasks}
        bulletins={bulletins}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-6">
          <KanbanBoard tasks={tasks} users={users} canEdit={canEditTasks} />
          <KeyTasksPanel
            keyTasks={keyTasks}
            users={users}
            canEdit={canEditKeyTasks}
          />
        </div>
        <div className="flex flex-col gap-4 sm:gap-6">
          <MeetingsWidget
            meetings={meetings}
            users={users}
            canEdit={canEditMeetings}
          />
          <BulletinFeed
            bulletins={bulletins}
            canEdit={canEditBulletins}
            canDelete={canDeleteBulletins}
          />
        </div>
      </div>
    </div>
  );
}

export default DashboardModule;
