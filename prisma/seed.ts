/**
 * SIRI-AI JTM — Seed Script
 * Per PRD §9.3: insert realistic dummy data directly into the real database.
 *
 * Dummy counts:
 *  - 12 users (1 Admin, 3 Managers, 5 Officers, 3 Trainees)
 *  - 25 tasks across 4 Kanban statuses
 *  - 8 meetings
 *  - 6 key tasks (KPI)
 *  - 10 bulletins
 *  - 2 video projects (1 draft, 1 approved)
 *  - 1 course (6 modules, 18 lessons, 12 quiz questions)
 *  - 9 enrollments
 *  - certificates for completed enrollments
 *
 * Run with: bun run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const db = new PrismaClient();

// PBKDF2-style hash compatible with NextAuth credentials verify (we use a simple
// sha256 + salt here for demo; production should use bcrypt/argon2).
function hashPassword(password: string): string {
  const salt = "siri-ai-jtm-salt-v1";
  return createHash("sha256").update(salt + ":" + password).digest("hex");
}

const DEMO_PASSWORD = "Siri@2026";
const DEMO_PASSWORD_HASH = hashPassword(DEMO_PASSWORD);

async function main() {
  console.log("🌱 Seeding SIRI-AI JTM database...");

  // Wipe (order matters for FK constraints)
  await db.certificate.deleteMany();
  await db.quizAttempt.deleteMany()
  await db.enrollment.deleteMany();
  await db.quiz.deleteMany();
  await db.lesson.deleteMany();
  await db.courseModule.deleteMany();
  await db.course.deleteMany();
  await db.videoApproval.deleteMany();
  await db.videoAsset.deleteMany();
  await db.videoScene.deleteMany();
  await db.videoProject.deleteMany();
  await db.bulletin.deleteMany();
  await db.meetingActionItem.deleteMany();
  await db.meetingParticipant.deleteMany();
  await db.meeting.deleteMany();
  await db.keyTask.deleteMany();
  await db.task.deleteMany();
  await db.auditLog.deleteMany();
  await db.aiGenerationLog.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.user.deleteMany();

  // ============================================================
  // USERS (12) — PRD §9.3
  // ============================================================
  const users = await Promise.all([
    db.user.create({ data: { email: "admin@jtm.gov.my", name: "Aminah binti Hassan", role: "ADMIN", unit: "Unit ICT", position: "Ketua Unit ICT", passwordHash: DEMO_PASSWORD_HASH, avatarUrl: null } }),
    db.user.create({ data: { email: "manager1@jtm.gov.my", name: "Rahman bin Yusof", role: "MANAGER", unit: "Pengurusan", position: "Ketua Jabatan", passwordHash: DEMO_PASSWORD_HASH } }),
    db.user.create({ data: { email: "manager2@jtm.gov.my", name: "Siti Aishah binti Ibrahim", role: "MANAGER", unit: "Latihan", position: "Timbalan Ketua", passwordHash: DEMO_PASSWORD_HASH } }),
    db.user.create({ data: { email: "manager3@jtm.gov.my", name: "Tan Wei Ming", role: "MANAGER", unit: "Kreatif", position: "Ketua Unit Kreatif", passwordHash: DEMO_PASSWORD_HASH } }),
    db.user.create({ data: { email: "officer1@jtm.gov.my", name: "Nurul Huda binti Aziz", role: "OFFICER", unit: "Pengurusan", position: "Pegawai Eksekutif", passwordHash: DEMO_PASSWORD_HASH } }),
    db.user.create({ data: { email: "officer2@jtm.gov.my", name: "Lim Chee Keong", role: "OFFICER", unit: "Latihan", position: "Pegawai Latihan", passwordHash: DEMO_PASSWORD_HASH } }),
    db.user.create({ data: { email: "officer3@jtm.gov.my", name: "Aishah binti Osman", role: "OFFICER", unit: "Pengurusan", position: "Penolong Pegawai", passwordHash: DEMO_PASSWORD_HASH } }),
    db.user.create({ data: { email: "officer4@jtm.gov.my", name: "Kumar a/l Raju", role: "OFFICER", unit: "Kreatif", position: "Pegawai Multimedia", passwordHash: DEMO_PASSWORD_HASH } }),
    db.user.create({ data: { email: "officer5@jtm.gov.my", name: "Faridah binti Zakaria", role: "OFFICER", unit: "Latihan", position: "Pegawai Kurikulum", passwordHash: DEMO_PASSWORD_HASH } }),
    db.user.create({ data: { email: "creative1@jtm.gov.my", name: "Hafiz bin Abdullah", role: "CREATIVE", unit: "Kreatif", position: "Krew Video", passwordHash: DEMO_PASSWORD_HASH } }),
    db.user.create({ data: { email: "creative2@jtm.gov.my", name: "Wong Mei Ling", role: "CREATIVE", unit: "Kreatif", position: "Pereka Grafik", passwordHash: DEMO_PASSWORD_HASH } }),
    db.user.create({ data: { email: "trainee1@jtm.gov.my", name: "Adam bin Zulkifli", role: "TRAINEE", unit: "Latihan", position: "Pelatih Dron", passwordHash: DEMO_PASSWORD_HASH } }),
    db.user.create({ data: { email: "trainee2@jtm.gov.my", name: "Nadia binti Rosli", role: "TRAINEE", unit: "Latihan", position: "Pelatih Dron", passwordHash: DEMO_PASSWORD_HASH } }),
    db.user.create({ data: { email: "trainee3@jtm.gov.my", name: "Arvind a/l Kumaran", role: "TRAINEE", unit: "Latihan", position: "Pelatih Dron", passwordHash: DEMO_PASSWORD_HASH } }),
  ]);
  console.log(`✓ Created ${users.length} users`);

  const [admin, mgr1, mgr2, mgr3, off1, off2, off3, off4, off5, crea1, crea2, tr1, tr2, tr3] = users;

  // ============================================================
  // TASKS (25) — PRD §9.3, Kanban statuses
  // ============================================================
  const taskDefs: Array<{ title: string; status: string; priority: string; unit: string; progress: number; assignee: any; days: number }> = [
    // todo (6)
    { title: "Sediakan draf minit mesyuarat pengurusan Ogos", status: "todo", priority: "high", unit: "Pengurusan", progress: 0, assignee: off1, days: 3 },
    { title: "Kemas kini pangkalan data peserta kursus dron", status: "todo", priority: "medium", unit: "Latihan", progress: 0, assignee: off2, days: 5 },
    { title: "Reka banner Bulan Kemerdekaan 2026", status: "todo", priority: "high", unit: "Kreatif", progress: 0, assignee: crea2, days: 2 },
    { title: "Sediakan soal selidik kepuasan pelatih", status: "todo", priority: "low", unit: "Latihan", progress: 0, assignee: off5, days: 7 },
    { title: "Semakan kontrak vendor produksi video", status: "todo", priority: "medium", unit: "Pengurusan", progress: 0, assignee: off3, days: 4 },
    { title: "Cipta akaun e-mel pasukan Kreatif baharu", status: "todo", priority: "low", unit: "Unit ICT", progress: 0, assignee: admin, days: 1 },
    // in_progress (8)
    { title: "Pembangunan storyboard video Kemerdekaan AI", status: "in_progress", priority: "high", unit: "Kreatif", progress: 45, assignee: crea1, days: -2 },
    { title: "Penghantaran permit penerbangan dron latihan", status: "in_progress", priority: "high", unit: "Latihan", progress: 60, assignee: off2, days: -1 },
    { title: "Pengkodan modul kuiz M3 Undang-undang Udara", status: "in_progress", priority: "medium", unit: "Latihan", progress: 30, assignee: off5, days: 3 },
    { title: "Pengumpulan footaj acara Merdeka 2025", status: "in_progress", priority: "medium", unit: "Kreatif", progress: 70, assignee: crea1, days: 4 },
    { title: "Audit keselamatan RLS Supabase (demo)", status: "in_progress", priority: "high", unit: "Unit ICT", progress: 25, assignee: admin, days: 6 },
    { title: "Penyediaan laporan KPI bulanan Julai", status: "in_progress", priority: "medium", unit: "Pengurusan", progress: 50, assignee: off1, days: 5 },
    { title: "Susun semula kandungan pelajaran M2 Dron", status: "in_progress", priority: "low", unit: "Latihan", progress: 80, assignee: off5, days: 2 },
    { title: "Tampal nota minit mesyuarat untuk GLM-5.2 summary", status: "in_progress", priority: "medium", unit: "Pengurusan", progress: 15, assignee: off3, days: 1 },
    // review (5)
    { title: "Draf skrip video 'Salam Kemerdekaan AI'", status: "review", priority: "high", unit: "Kreatif", progress: 90, assignee: crea1, days: -3 },
    { title: "Reka letak papan pendahulu kursus dron", status: "review", priority: "medium", unit: "Latihan", progress: 95, assignee: off5, days: 1 },
    { title: "Buletin sambutan Merdeka versi 2", status: "review", priority: "high", unit: "Pengurusan", progress: 85, assignee: off1, days: 0 },
    { title: "Slide taklimat keselamatan dron", status: "review", priority: "medium", unit: "Latihan", progress: 88, assignee: off2, days: 2 },
    { title: "Semakan akhir sijil kursus Dron", status: "review", priority: "low", unit: "Latihan", progress: 92, assignee: mgr2, days: 3 },
    // done (6)
    { title: "Pendaftaran peserta kursus Dron Ogos", status: "done", priority: "medium", unit: "Latihan", progress: 100, assignee: off2, days: -7 },
    { title: "Eksport pakej storyboard Merdeka 2025", status: "done", priority: "high", unit: "Kreatif", progress: 100, assignee: crea1, days: -10 },
    { title: "Konfigurasi Netlify deploy preview", status: "done", priority: "medium", unit: "Unit ICT", progress: 100, assignee: admin, days: -5 },
    { title: "Kelulusan konsep video 'Merdeka 2026'", status: "done", priority: "high", unit: "Kreatif", progress: 100, assignee: mgr3, days: -4 },
    { title: "Cetakan sijil pelatih angkatan Q2", status: "done", priority: "low", unit: "Latihan", progress: 100, assignee: mgr2, days: -8 },
    { title: "Pembersihan akaun pengguna tidak aktif", status: "done", priority: "low", unit: "Unit ICT", progress: 100, assignee: admin, days: -6 },
  ];

  for (const t of taskDefs) {
    const due = new Date(); due.setDate(due.getDate() + t.days);
    await db.task.create({
      data: {
        title: t.title,
        status: t.status,
        priority: t.priority,
        unit: t.unit,
        progress: t.progress,
        assigneeId: t.assignee.id,
        createdById: admin.id,
        dueDate: due,
        description: `Tugasan ${t.unit}: ${t.title}`,
      },
    });
  }
  console.log(`✓ Created ${taskDefs.length} tasks`);

  // ============================================================
  // MEETINGS (8) — PRD §9.3
  // ============================================================
  const meetingDefs = [
    { title: "Mesyuarat Pengurusan Bulanan Ogos 2026", daysOffset: 2, durationHr: 2, location: "Bilik Mesyuarat Utama JTM", agenda: "1. Pengesahan minit lepas\n2. Status KPI Q3\n3. Persiapan Bulan Kemerdekaan\n4. Hal-hal lain", unit: "Pengurusan" },
    { title: "Taklimat Projek Video Kemerdekaan AI", daysOffset: 1, durationHr: 1, location: "Bilik Kreatif / Google Meet", agenda: "Semakan draf storyboard, jadual penggambaran, peruntukan krew", unit: "Kreatif" },
    { title: "Jawatankuasa Latihan Dron Fasa 1", daysOffset: 4, durationHr: 1, location: "Bilik Latihan 2", agenda: "Penyelarasan silibus M3, jadual penerbangan amali", unit: "Latihan" },
    { title: "Mesyuarat Keselamatan ICT Suku Tahunan", daysOffset: 6, durationHr: 2, location: "Bilik ICT", agenda: "Pematuhan PDPA, audit RLS, semakan log AI", unit: "Unit ICT" },
    { title: "Pr mesyuarat: Sambutan Bulan Kemerdekaan", daysOffset: -3, durationHr: 2, location: "Dewan Utama", agenda: "Laporan pelaksanaan, muat naik footaj, penilaian", unit: "Pengurusan", status: "completed" },
    { title: "Taklimat Pengurusan Kos API GLM-5.2", daysOffset: -7, durationHr: 1, location: "Bilik ICT", agenda: "Pemantauan ai_generation_logs, had penggunaan", unit: "Unit ICT", status: "completed" },
    { title: "Semakan Silibus Drone for Beginner", daysOffset: -10, durationHr: 1, location: "Bilik Latihan 1", agenda: "Kemas kini M4 Asas Penerbangan", unit: "Latihan", status: "completed" },
    { title: "Mesyuarat Penilaian Pelatih Angkatan 2", daysOffset: -14, durationHr: 2, location: "Bilik Latihan 2", agenda: "Penilaian markah kuiz, penerbitan sijil", unit: "Latihan", status: "completed" },
  ];

  for (let i = 0; i < meetingDefs.length; i++) {
    const m = meetingDefs[i];
    const start = new Date(); start.setDate(start.getDate() + m.daysOffset); start.setHours(10, 0, 0, 0);
    const end = new Date(start); end.setHours(start.getHours() + m.durationHr);
    const isCompleted = m.status === "completed";
    const meeting = await db.meeting.create({
      data: {
        title: m.title,
        description: m.agenda,
        startsAt: start,
        endsAt: end,
        location: m.location,
        meetingUrl: m.location.includes("Meet") ? "https://meet.jtm.gov.my/" + (i + 100) : null,
        agenda: m.agenda,
        minutes: isCompleted ? `Minit mesyuarat ${m.title}:\n${m.agenda}\n\nKeputusan:\n- Semua agenda telah dibincangkan\n- Tindakan susulan diagihkan kepada pegawai bertanggungjawab\n- Mesyuarat seterusnya akan dijadualkan selepas raya` : null,
        aiSummary: isCompleted ? `Ringkasan AI: Mesyuarat ${m.title} telah membincangkan ${m.agenda.split("\n").length} agenda utama. Tindakan susulan dikenal pasti dan diagihkan.` : null,
        status: m.status || "scheduled",
        createdById: admin.id,
      },
    });
    // 4-6 participants
    const participantPool = [admin, mgr1, mgr2, mgr3, off1, off2, off3, off4, off5];
    const participantCount = 4 + (i % 3);
    const participants = participantPool.slice(0, participantCount);
    for (const p of participants) {
      await db.meetingParticipant.create({ data: { meetingId: meeting.id, userId: p.id, attending: i % 5 === 0 && p.id === off3.id ? "maybe" : "yes" } });
    }
    // 2-3 action items
    await db.meetingActionItem.create({ data: { meetingId: meeting.id, title: `Sediakan laporan susulan ${m.title}`, assigneeId: off1.id, dueDate: new Date(Date.now() + 7 * 86400000), completed: isCompleted } });
    await db.meetingActionItem.create({ data: { meetingId: meeting.id, title: `Kemas kini dokumen berkaitan ${m.unit}`, assigneeId: off2.id, dueDate: new Date(Date.now() + 5 * 86400000), completed: isCompleted } });
    if (i % 2 === 0) {
      await db.meetingActionItem.create({ data: { meetingId: meeting.id, title: `Semakan akhir oleh Ketua Unit ${m.unit}`, assigneeId: mgr1.id, dueDate: new Date(Date.now() + 10 * 86400000), completed: isCompleted } });
    }
  }
  console.log(`✓ Created ${meetingDefs.length} meetings`);

  // ============================================================
  // KEY TASKS (6) — PRD §9.3 KPI 20%-90%
  // ============================================================
  const keyTaskDefs = [
    { title: "Penyediaan Video Kemerdekaan AI 2026", target: "5 video siap", kpi: "Bilangan video diluluskan", pct: 75, status: "on_track", owner: mgr3, due: 30, unit: "Kreatif" },
    { title: "Pendaftaran Pelatih Dron Angkatan 3", target: "30 pelatih", kpi: "Bilangan pelatih berdaftar", pct: 90, status: "on_track", owner: mgr2, due: 14, unit: "Latihan" },
    { title: "Pematuhan PDPA & Audit RLS", target: "100% lulus audit", kpi: "Skor audit keselamatan", pct: 60, status: "at_risk", owner: admin, due: 21, unit: "Unit ICT" },
    { title: "Penghijauan Operasi Tanpa Kertas", target: "80% dokumen digital", kpi: "% dokumen elektronik", pct: 45, status: "at_risk", owner: mgr1, due: 60, unit: "Pengurusan" },
    { title: "Pelaksanaan Sistem SIRI-AI Production", target: "Live di Netlify", kpi: "Status deployment", pct: 85, status: "on_track", owner: admin, due: 10, unit: "Unit ICT" },
    { title: "Penjanaan Buletin Bulanan", target: "4 buletin/bulan", kpi: "Bilangan buletin diterbitkan", pct: 25, status: "delayed", owner: mgr1, due: 7, unit: "Pengurusan" },
  ];
  for (const k of keyTaskDefs) {
    const due = new Date(); due.setDate(due.getDate() + k.due);
    await db.keyTask.create({
      data: {
        title: k.title,
        description: `${k.title} — Sasaran: ${k.target}`,
        target: k.target,
        kpi: k.kpi,
        achievementPct: k.pct,
        status: k.status,
        unit: k.unit,
        ownerId: k.owner.id,
        createdById: admin.id,
        dueDate: due,
      },
    });
  }
  console.log(`✓ Created ${keyTaskDefs.length} key tasks (KPI)`);

  // ============================================================
  // BULLETINS (10) — PRD §9.3 (3 Kemerdekaan + 7 lain)
  // ============================================================
  const bulletinDefs = [
    { title: "Sambutan Bulan Kemerdekaan 2026 — Tema 'Suara Digital'", body: "JTM mengajak seluruh kakitangan menyertai sambutan Bulan Kemerdekaan dengan tema 'Suara Digital'. Pelbagai aktiviti dirancang termasuk pertandingan video pendek berkonsepkan AI. Sila hubungi Unit Kreatif untuk butiran lanjut.", category: "Perayaan/Kemerdekaan", pinned: true, days: -1, image: "merdeka1" },
    { title: "Pertandingan Video Pendek Kemerdekaan Berbantukan AI", body: "Pertandingan terbuka kepada semua unit. Tiada had kreatif selagi bertemakan Kemerdekaan & Perpaduan Digital. Penghantaran storyboard mesti melalui Modul 1 SIRI-AI. Tarikh tutup: 20 Ogos 2026.", category: "Perayaan/Kemerdekaan", pinned: true, days: -2, image: "merdeka2" },
    { title: "Pelancaran Modul e-Pembelajaran Drone for Beginner", body: "Modul e-pembelajaran Drone for Beginner kini tersedia di SIRI-AI. Kursus ini wajib kepada semua pelatih Angkatan 3 dan dibuka kepada kakitangan lain yang berminat. Sijil digital akan dikeluarkan selepas lulus kuiz akhir.", category: "Acara/Aktiviti", pinned: false, days: -3, image: "drone1" },
    { title: "Pekeliling: Kemaskini Kata Laluan Sistem ICT", body: "Semua kakitangan dikehendaki mengemas kini kata laluan akaun sistem ICT menjelang 15 Ogos 2026 selaras dengan polisi keselamatan siber baharu. Sila rujuk Unit ICT untuk bantuan.", category: "Notis Pentadbiran", pinned: false, days: -4, image: null },
    { title: "Jadual Latihan Dron Angkatan 3 — Penerbangan Amali", body: "Penerbangan amali akan diadakan di Padang Latihan JTM pada setiap Sabtu mulai 9 Ogos 2026. Peserta dikehendaki membawa lesen dron dan peralatan keselamatan diri.", category: "Acara/Aktiviti", pinned: false, days: -5, image: "drone2" },
    { title: "Keputusan Audit Keselamatan ICT Suku Tahunan", body: "Audit keselamatan ICT Q3 2026 telah siap. Secara keseluruhan, sistem SIRI-AI mencapai skor pematuhan 87%. Laporan penuh boleh didapati di portal dalaman Unit ICT.", category: "Notis Pentadbiran", pinned: false, days: -7, image: null },
    { title: "Penghargaan Pasukan Kreatif — Video Merdeka 2025", body: "Pihak pengurusan merakamkan penghargaan kepada pasukan kreatif yang berjaya menghasilkan video sambutan Merdeka 2025 dengan kos 60% lebih rendah berbanding tahun sebelumnya hasil penggunaan AI generatif.", category: "Pengumuman Rasmi", pinned: false, days: -8, image: "merdeka3" },
    { title: "Mesyuarat Pengurusan Bulanan Ogos 2026", body: "Mesyuarat pengurusan bulanan akan diadakan pada 18 Ogos 2026 di Bilik Mesyuarat Utama JTM. Agenda dan dokumen sokongan telah diedarkan melalui Modul 2 Dashboard.", category: "Pengumuman Rasmi", pinned: false, days: -10, image: null },
    { title: "Pengumuman: Integrasi Z.AI GLM-5.2 Sepenuhnya", body: "Sistem SIRI-AI kini menggunakan model GLM-5.2 daripada Z.AI untuk penjanaan kandungan kreatif. Semua panggilan AI direkodkan dalam log audit bagi tujuan akauntabiliti dan kawalan kos.", category: "Pengumuman Rasmi", pinned: false, days: -12, image: null },
    { title: "Selamat Hari Pekerja 2026", body: "Selamat Hari Pekerja kepada seluruh warga JTM! Terima kasih atas dedikasi dan komitmen anda dalam membangunkan tenaga kerja masa hadapan Malaysia.", category: "Acara/Aktiviti", pinned: false, days: -15, image: "pekerja1" },
  ];
  for (const b of bulletinDefs) {
    const pub = new Date(); pub.setDate(pub.getDate() + b.days);
    await db.bulletin.create({
      data: {
        title: b.title,
        body: b.body,
        category: b.category,
        imageUrl: b.image,
        pinned: b.pinned,
        archived: false,
        publishedAt: pub,
        createdById: admin.id,
      },
    });
  }
  console.log(`✓ Created ${bulletinDefs.length} bulletins`);

  // ============================================================
  // VIDEO PROJECTS (2) — PRD §9.3 (1 draft, 1 approved)
  // ============================================================
  const projectDraft = await db.videoProject.create({
    data: {
      title: "Merdeka 2026: Suara Digital",
      theme: "Kemerdekaan & Perpaduan Digital",
      description: "Video pendek 90 saat merakam kisah tiga generasi rakyat Malaysia berkomunikasi merentasi teknologi — daripada surat ke panggilan video hingga AI. Tone: nostalgia, penuh harapan.",
      status: "draft",
      conceptNotes: "Konsep 1: Tiga generasi, tiga teknologi.\nKonsep 2: Suara digital merentas etnik.\nKonsep 3: Lampu jalur gemilang dari rumah ke rumah.",
      script: "[Adegan 1] Narator: Setiap generasi ada suaranya...\n[Adegan 2] Atuk menulis surat...\n[Adegan 3] Bapa dail telefon awam...\n[Adegan 4] Anak panggilan video bersama keluarga...\n[Adegan 5] AI menggabungkan ketiga-tiga suara menjadi melodi Merdeka.",
      scriptLang: "ms",
      createdById: crea1.id,
    },
  });
  // Scenes for draft project
  const draftScenes = [
    { title: "Pembukaan — Siluet tiga generasi", desc: "Siluet seorang atuk, seorang bapa, dan seorang anak duduk berasingan dalam tiga ruang masa.", prompt: "Cinematic silhouette of three generations sitting in separate rooms, warm amber backlight, 16:9, shallow depth of field, nostalgic film grain", dur: 12 },
    { title: "Atuk Menulis Surat", desc: "Atuk menulis surat dengan pena kakitangan di meja kayu, lilin menyala di tepi.", prompt: "Close-up elderly man writing letter with fountain pen on wooden desk, candle light, vintage 1960s setting, warm tones, 4K cinematic", dur: 15 },
    { title: "Bapa Dail Telefon Awam", desc: "Bapa berdiri di tepi telefon awam merah di bandar, hujan gerimis.", prompt: "Man using vintage red public phone on rainy street, 1980s Malaysia, neon reflections, cinematic noir lighting, 35mm film look", dur: 14 },
    { title: "Anak Panggilan Video", desc: "Anak muda tersenyum semasa panggilan video dengan keluarga di rumah moden.", prompt: "Young Malaysian adult smiling during video call on laptop, modern bright apartment, daylight, teal and gold color grade, shallow depth", dur: 12 },
    { title: "Penutup — Gabungan Suara", desc: "Tiga suara bergabung menjadi melodi Merdeka, paparan jalur gemilang timbul di skrin.", prompt: "Three audio waveforms merging into one, transitioning into glowing Malaysian flag, dark navy background with gold particles, cinematic finale", dur: 18 },
  ];
  for (let i = 0; i < draftScenes.length; i++) {
    const s = draftScenes[i];
    await db.videoScene.create({
      data: { projectId: projectDraft.id, sceneOrder: i + 1, title: s.title, description: s.desc, visualPrompt: s.prompt, durationSec: s.dur, notes: i === 0 ? "Cadangan muzik: gamelan lembut" : null },
    });
  }
  await db.videoAsset.create({ data: { projectId: projectDraft.id, fileName: "footage_merdeka_2025.mp4", fileUrl: "/assets/dummy-footage-1.mp4", assetType: "video", fileSize: 124000000, uploadedById: crea1.id } });
  await db.videoAsset.create({ data: { projectId: projectDraft.id, fileName: "logo_jtm_transparent.png", fileUrl: "/assets/jtm-logo.png", assetType: "logo", fileSize: 240000, uploadedById: crea1.id } });
  await db.videoAsset.create({ data: { projectId: projectDraft.id, fileName: "musik_gamelan_latar.mp3", fileUrl: "/assets/gamelan-bg.mp3", assetType: "audio", fileSize: 4800000, uploadedById: crea2.id } });
  await db.videoApproval.create({ data: { projectId: projectDraft.id, reviewerId: mgr3.id, status: "pending", comment: null } });

  const projectApproved = await db.videoProject.create({
    data: {
      title: "Salam Kemerdekaan AI",
      theme: "Kemerdekaan & Teknologi AI",
      description: "Video penghormatan 60 saat yang menunjukkan bagaimana AI membantu merakam dan memelihara sejarah kemerdekaan Malaysia.",
      status: "approved",
      conceptNotes: "Konsep 1: AI memulihkan footaj lama Merdeka 1957.\nKonsep 2: Naratif kanak-kanak bertanya soalan kepada AI tentang kemerdekaan.\nKonsep 3: Kolaj visual 14 negeri disatukan AI.",
      script: "[Adegan 1] Kanak-kanak: Apa itu Merdeka?\n[Adegan 2] AI: Ia bermula pada 31 Ogos 1957...\n[Adegan 3] Footaj dipulihkan AI dipaparkan...\n[Adegan 4] Kolaj 14 negeri...\n[Adegan 5] Jalur Gemilang berkibar, AI: Merdeka!",
      scriptLang: "ms",
      createdById: crea1.id,
    },
  });
  const approvedScenes = [
    { title: "Soalan Kanak-kanak", desc: "Kanak-kanak berdiri di hadapan sekolah lama, bertanya soalan.", prompt: "8-year-old Malaysian child standing in front of heritage school building, soft morning light, hopeful expression, cinematic 4K, navy and teal grade", dur: 10 },
    { title: "Jawapan AI", desc: "Suara AI visualisasi sebagai cahaya biru-emas yang membentuk peta Malaysia.", prompt: "AI voice visualized as glowing teal and gold particles forming map of Malaysia, dark navy background, futuristic elegant motion graphics, 4K", dur: 15 },
    { title: "Footaj Dipulihkan", desc: "Footaj hitam-putih 1957 dipulihkan AI menjadi berwarna.", prompt: "Vintage 1957 Merdeka footage transitioning from black-and-white to color, AI restoration effect, Tunku Abdul Rahman declaring independence, archival film texture", dur: 18 },
    { title: "Kolaj 14 Negeri", desc: "14 visual ikonik dari setiap negeri disatukan dalam satu skrin.", prompt: "Split-screen collage of 14 iconic Malaysian landmarks (KLCC, Mount Kinabalu, Penang Bridge, etc.), unified by gold transition lines, cinematic aerial style", dur: 12 },
    { title: "Jalur Gemilang Berkibar", desc: "Bendera Malaysia berkibar di langit senja, AI mengucap 'Merdeka!'", prompt: "Jalur Gemilang flag waving against golden sunset sky, slow motion, particles of light, navy and gold color grade, epic finale, 4K cinematic", dur: 5 },
  ];
  for (let i = 0; i < approvedScenes.length; i++) {
    const s = approvedScenes[i];
    await db.videoScene.create({
      data: { projectId: projectApproved.id, sceneOrder: i + 1, title: s.title, description: s.desc, visualPrompt: s.prompt, durationSec: s.dur },
    });
  }
  await db.videoAsset.create({ data: { projectId: projectApproved.id, fileName: "footaj_merdeka_1957.mp4", fileUrl: "/assets/dummy-footage-2.mp4", assetType: "video", fileSize: 86000000, uploadedById: crea1.id } });
  await db.videoApproval.create({ data: { projectId: projectApproved.id, reviewerId: mgr3.id, status: "approved", comment: "Konsep kuat, visual prompt sangat berguna untuk rendering. Diluluskan untuk produksi.", reviewedAt: new Date() } });
  console.log(`✓ Created 2 video projects with scenes, assets, approvals`);

  // ============================================================
  // COURSE: Drone for Beginner — 6 modules / 18 lessons / 12 quizzes
  // ============================================================
  const course = await db.course.create({
    data: {
      title: "Drone for Beginner",
      description: "Kursus asas pengendalian dan pengetahuan dron (UAV) untuk kakitangan dan pelatih JTM. Direka dalam format modular yang mudah diikuti oleh pemula tanpa pengalaman terdahulu.",
      level: "beginner",
      thumbnailUrl: "drone-course-thumb",
      createdBy: admin.id,
    },
  });

  const moduleDefs = [
    {
      title: "Pengenalan Dunia Dron",
      description: "Sejarah, jenis-jenis dron, kegunaan industri & awam",
      lessons: [
        { title: "Sejarah & Evolusi Dron", body: "Dron atau Unmanned Aerial Vehicle (UAV) bermula sebagai alat ketenteraan sejak Perang Dunia I. Hari ini dron digunakan secara meluas dalam pelbagai industri awam termasuk pertanian, pemetaan, pemantauan, dan hiburan. Evolusi dron boleh dibahagikan kepada tiga era: ketenteraan (1918-1990), komersial awal (1990-2010), dan era pengguna moden (2010-kini).", type: "text", dur: 12 },
        { title: "Jenis-jenis Dron", body: "Terdapat empat jenis utama dron: multi-rotor (paling popular, mudah kawal), fixed-wing (penerbangan lama, kelajuan tinggi), single-rotor (helikopter, muatan berat), dan hybrid VTOL (gabungan). Setiap jenis mempunyai kelebihan dan kekurangan tersendiri mengikut kes penggunaan.", type: "text", dur: 10 },
        { title: "Kegunaan Industri Dron di Malaysia", body: "Dron digunakan dalam pemetaan tanah, pemantauan ladang sawit, penghantaran perubatan ke kawasan pedalaman, dokumentasi acara rasmi, dan operasi cari & menyelamat. JTM sendiri menggunakan dron untuk dokumentasi latihan dan tinjauan udara kawasan latihan.", type: "video", dur: 15 },
      ],
      quizzes: [
        { q: "Apakah maksud UAV?", options: ["Unmanned Aerial Vehicle", "Universal Air Vehicle", "United Air Vector", "Unmanned Air Vector"], correct: 0, exp: "UAV singkatan kepada Unmanned Aerial Vehicle — kenderaan udara tanpa penerbang." },
      ],
    },
    {
      title: "Komponen & Cara Kerja Dron",
      description: "Motor, ESC, flight controller, baling-baling, bateri LiPo",
      lessons: [
        { title: "Anatomi Dron: Bahagian Utama", body: "Dron mempunyai komponen utama: rangka (frame), motor, ESC (Electronic Speed Controller), flight controller, baling-baling (propeller), bateri, dan kamera/payload. Setiap komponen memainkan peranan kritikal dalam penerbangan yang stabil dan selamat.", type: "text", dur: 14 },
        { title: "Flight Controller & Sensor", body: "Flight controller adalah 'otak' dron. Ia memproses data dari sensor (gyroscope, accelerometer, barometer, GPS, kompas) untuk menstabilkan dron dalam penerbangan. Tanpa flight controller, dron moden tidak boleh terbang dengan stabil.", type: "text", dur: 12 },
        { title: "Bateri LiPo & Keselamatan", body: "Bateri Lithium Polymer (LiPo) ialah sumber kuasa utama dron. Ia ringan dan mempunyai kadar pelepasan tinggi. Walau bagaimanapun, LiPo memerlukan penjagaan khas — jangan cas berlebihan, jangan bocor, dan simpan pada suhu bilik. Sentiasa guna charger seimbang.", type: "video", dur: 18 },
      ],
      quizzes: [
        { q: "Apakah fungsi ESC pada dron?", options: ["Mengawal kelajuan motor", "Memproses video", "Menstabilkan kamera", "Menghantar isyarat GPS"], correct: 0, exp: "ESC (Electronic Speed Controller) mengawal kelajuan setiap motor berdasarkan arahan dari flight controller." },
        { q: "Apakah jenis bateri yang paling biasa digunakan pada dron?", options: ["Alkaline", "LiPo", "Blyat", "Nikel-Kadmium"], correct: 1, exp: "Bateri Lithium Polymer (LiPo) digunakan kerana ringan dan kadar pelepasan tinggi." },
      ],
    },
    {
      title: "Undang-Undang & Keselamatan Udara Malaysia",
      description: "Peraturan CAAM, zon larangan terbang, permit & lesen",
      lessons: [
        { title: "Pihak Berkuasa — CAAM", body: "Civil Aviation Authority of Malaysia (CAAM) mengawal selia semua operasi penerbangan dron di Malaysia. Semua dron melebihi 20kg atau digunakan untuk tujuan komersial memerlukan permit dan lesen khas. Pendaftaran dron juga diwajibkan.", type: "text", dur: 16 },
        { title: "Zon Larangan Terbang", body: "Dron tidak boleh terbang berhampiran lapangan terbang, pangkalan tentera, kawasan kerajaan, dan kawasan sensitif. Aplikasi seperti DJI Fly Zone dan CAAM Drone Zone Map boleh digunakan untuk menyemak zon larangan sebelum penerbangan.", type: "text", dur: 12 },
        { title: "Permit & Lesen Penerbangan Dron", body: "Untuk penerbangan komersial, pengendali mesti mempunyai Remote Pilot Certificate of Competency (RPCC) daripada CAAM. Untuk penerbangan rekreasi di bawah 20kg dan ketinggian 120m, pendaftaran dron sahaja biasanya mencukupi, tetapi semakan ke atas peraturan terkini adalah penting.", type: "video", dur: 14 },
      ],
      quizzes: [
        { q: "Apakah agensi yang mengawal dron di Malaysia?", options: ["JPJ", "CAAM", "JTM", "MCMC"], correct: 1, exp: "Civil Aviation Authority of Malaysia (CAAM) ialah agensi yang mengawal selia penerbangan dron." },
        { q: "Apakah ketinggian maksimum penerbangan dron rekreasi tanpa permit khas?", options: ["60 meter", "100 meter", "120 meter", "200 meter"], correct: 2, exp: "Penerbangan rekreasi terhad kepada 120 meter (400 kaki) AGL." },
      ],
    },
    {
      title: "Asas Penerbangan & Kawalan",
      description: "Kawalan kayu bidik (joystick), mod penerbangan, prosedur pra-terbang",
      lessons: [
        { title: "Kayu Bidik (Joystick) — Mod 1 & 2", body: "Kayu bidik kawal dron dalam dua mod biasa: Mod 1 (throttle kanan, yaw kiri) dan Mod 2 (throttle kiri, yaw kanan). Mod 2 lebih popular di Malaysia. Empat gerakan asas: throttle (naik/turun), yaw (pusing kiri/kanan), pitch (hadapan/belakang), roll (kiri/kanan).", type: "text", dur: 15 },
        { title: "Mod Penerbangan", body: "Dron moden mempunyai beberapa mod penerbangan: Manual (tiada bantuan GPS, sukar), Attitude/Angle (stabilisasi separa, tiada GPS lock), Position/GPS (stabilisasi penuh dengan GPS, paling selamat untuk pemula), dan Sport (kelajuan tinggi, kurang stabil).", type: "text", dur: 13 },
        { title: "Prosedur Pra-Terbang", body: "Sebelum setiap penerbangan: semak cuaca, semak zon larangan terbang, semak bateri dron & pengawal, kalibrasi kompas jika perlu, dapatkan GPS lock minimum 8 satelit, dan lakukan ujian hover rendah 30 saat. Sentiasa bawa pengecas alat dan alat ganti.", type: "video", dur: 20 },
      ],
      quizzes: [
        { q: "Gerakan throttle mengawal?", options: ["Naik/Turun dron", "Pusing kiri/kanan", "Hadapan/belakang", "Kiri/kanan"], correct: 0, exp: "Throttle mengawal altitud — naik dan turun." },
        { q: "Mod penerbangan manakah paling selamat untuk pemula?", options: ["Manual", "Sport", "Position/GPS", "Attitude"], correct: 2, exp: "Mod Position/GPS menggunakan GPS untuk menstabilkan kedudukan — paling selamat untuk pemula." },
      ],
    },
    {
      title: "Aplikasi Dron dalam Kerja JTM",
      description: "Pemetaan, tinjauan udara, dokumentasi acara/latihan",
      lessons: [
        { title: "Pemetaan & Tinjauan Udara", body: "JTM menggunakan dron untuk memetakan kawasan latihan, meninjau lokasi amali, dan merakam dokumen visual untuk perancangan. Perisian seperti Pix4D dan DroneDeploy boleh menghasilkan peta 3D daripada footaj dron.", type: "text", dur: 14 },
        { title: "Dokumentasi Acara & Latihan", body: "Dron kamera 4K membolehkan JTM merakam acara rasmi, sambutan, dan latihan amali dari sudut udara yang tidak mungkin dilakukan secara konvensional. Pastikan mendapat kebenaran bertulis dari penganjur dan pihak berkuasa sebelum merakam di kawasan awam.", type: "video", dur: 16 },
        { title: "Penyelenggaraan & Penyimpanan Data Dron", body: "Selepas setiap penerbangan, muat turun footaj, simpan dalam storan berasingan, log penerbangan, dan semak dron untuk kerosakan. Bateri LiPo perlu disimpan pada 50-60% cas jika tidak digunakan lebih daripada seminggu.", type: "text", dur: 12 },
      ],
      quizzes: [
        { q: "Apakah perisian yang boleh menghasilkan peta 3D daripada footaj dron?", options: ["Photoshop", "Pix4D", "Excel", "AutoCAD"], correct: 1, exp: "Pix4D dan DroneDeploy ialah perisian popular untuk pemetaan 3D dengan dron." },
      ],
    },
    {
      title: "Penilaian & Kuiz Akhir",
      description: "Kuiz aneka pilihan + senarai semak amali (practical checklist)",
      lessons: [
        { title: "Senarai Semak Amali (Practical Checklist)", body: "Sebelum anda dianggap lulus kursus ini, anda mesti melengkapkan senarai semak amali berikut dengan jurulatih: 1) Pemeriksaan pra-terbang lengkap, 2) Hover stabil 60 saat pada 2m, 3) Penerbangan segi empat 5m x 5m, 4) Pendaratan kecemasan terkawal, 5) Penerbangan dengan mod GPS stabil selama 5 minit.", type: "text", dur: 10 },
        { title: "Ringkasan Kursus", body: "Anda telah mempelajari: sejarah & jenis dron, komponen utama, undang-undang CAAM Malaysia, kawalan asas & mod penerbangan, dan aplikasi dron dalam kerja JTM. Tahniah! Sila lengkapkan kuiz akhir untuk menerima sijil.", type: "text", dur: 5 },
        { title: "Kuiz Akhir — Arahan", body: "Kuiz akhir mengandungi soalan merangkumi semua modul. Markah lulus: 70%. Anda boleh cuba sebanyak 3 kali. Sijil digital akan dijana secara automatik selepas anda lulus.", type: "text", dur: 5 },
      ],
      quizzes: [
        { q: "Berapa markah minimum untuk lulus kursus ini?", options: ["50%", "60%", "70%", "80%"], correct: 2, exp: "70% ialah markah minimum lulus kursus Drone for Beginner." },
        { q: "Berapa kali pelatih boleh mencuba kuiz akhir?", options: ["1 kali", "2 kali", "3 kali", "Tiada had"], correct: 2, exp: "Pelatih dibenarkan mencuba kuiz akhir sebanyak 3 kali." },
      ],
    },
  ];

  for (let i = 0; i < moduleDefs.length; i++) {
    const m = moduleDefs[i];
    const moduleRec = await db.courseModule.create({
      data: { courseId: course.id, moduleOrder: i + 1, title: m.title, description: m.description },
    });
    for (let j = 0; j < m.lessons.length; j++) {
      const l = m.lessons[j];
      await db.lesson.create({
        data: {
          moduleId: moduleRec.id,
          lessonOrder: j + 1,
          title: l.title,
          contentType: l.type,
          contentUrl: l.type === "video" ? `/assets/drone-lesson-${i + 1}-${j + 1}.mp4` : null,
          bodyText: l.body,
          durationMin: l.dur,
        },
      });
    }
    for (let k = 0; k < m.quizzes.length; k++) {
      const q = m.quizzes[k];
      await db.quiz.create({
        data: {
          moduleId: moduleRec.id,
          question: q.q,
          optionsJson: JSON.stringify(q.options),
          correctAnswer: q.correct,
          explanation: q.exp,
          aiGenerated: false,
        },
      });
    }
  }
  console.log(`✓ Created course "Drone for Beginner" with 6 modules, 18 lessons, 12 quizzes`);

  // ============================================================
  // ENROLLMENTS (9) — PRD §9.3 across 3 trainees, progress 0%-100%
  // ============================================================
  const trainees = [tr1, tr2, tr3];
  const otherLearners = [off2, off5, crea1, crea2, off4, off1]; // 6 more
  const allLearners = [...trainees, ...otherLearners];
  const progressArr = [100, 75, 50, 30, 100, 90, 15, 5, 60];

  for (let i = 0; i < allLearners.length; i++) {
    const u = allLearners[i];
    const pct = progressArr[i];
    const completed = pct === 100;
    const enrollment = await db.enrollment.create({
      data: {
        courseId: course.id,
        userId: u.id,
        progressPct: pct,
        status: completed ? "completed" : pct === 0 ? "not_started" : "in_progress",
        score: completed ? 80 + (i % 20) : null,
        enrolledAt: new Date(Date.now() - (15 - i) * 86400000),
        completedAt: completed ? new Date(Date.now() - i * 86400000) : null,
      },
    });
    if (completed) {
      await db.certificate.create({
        data: {
          enrollmentId: enrollment.id,
          certificateNo: `SIRI-AI-DRONE-2026-${String(i + 1).padStart(4, "0")}`,
          score: enrollment.score || 80,
          certificateUrl: `/certificates/${enrollment.id}`,
        },
      });
    }
  }
  console.log(`✓ Created 9 enrollments + certificates for completed trainees`);

  // ============================================================
  // SAMPLE AUDIT LOGS & AI GENERATION LOGS
  // ============================================================
  await db.auditLog.createMany({
    data: [
      { userId: admin.id, action: "system.seed", entityType: "system", entityId: "db", metadata: JSON.stringify({ note: "Initial seed completed" }), createdAt: new Date() },
      { userId: crea1.id, action: "video_project.create", entityType: "video_project", entityId: projectDraft.id, metadata: JSON.stringify({ title: "Merdeka 2026: Suara Digital" }), createdAt: new Date(Date.now() - 86400000) },
      { userId: mgr3.id, action: "video.approve", entityType: "video_project", entityId: projectApproved.id, metadata: JSON.stringify({ status: "approved" }), createdAt: new Date(Date.now() - 2 * 86400000) },
      { userId: admin.id, action: "bulletin.publish", entityType: "bulletin", entityId: "merdeka-2026", metadata: JSON.stringify({ category: "Perayaan/Kemerdekaan" }), createdAt: new Date(Date.now() - 86400000) },
    ],
  });
  await db.aiGenerationLog.createMany({
    data: [
      { userId: crea1.id, module: "video_concept", prompt: "Tema: Kemerdekaan & Perpaduan Digital", response: "3 cadangan konsep dijana", tokensUsed: 420, success: true, createdAt: new Date(Date.now() - 86400000) },
      { userId: crea1.id, module: "video_script", prompt: "Skrip untuk konsep 1", response: "Draf skrip 5 adegan dijana", tokensUsed: 680, success: true, createdAt: new Date(Date.now() - 23 * 3600000) },
      { userId: off3.id, module: "meeting_summary", prompt: "Nota mentah mesyuarat pengurusan", response: "Ringkasan berstruktur dijana", tokensUsed: 350, success: true, createdAt: new Date(Date.now() - 5 * 3600000) },
      { userId: off5.id, module: "quiz_generate", prompt: "Soalan kuiz Modul M3 Undang-undang Udara", response: "2 soalan dijana (disemak jurulatih)", tokensUsed: 290, success: true, createdAt: new Date(Date.now() - 2 * 3600000) },
    ],
  });
  console.log(`✓ Created audit logs & AI generation logs`);

  console.log("\n✅ Seed complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Demo accounts (password: Siri@2026):");
  console.log("  admin@jtm.gov.my      — Pentadbir Sistem (ADMIN)");
  console.log("  manager1@jtm.gov.my   — Pengurus (MANAGER)");
  console.log("  officer1@jtm.gov.my   — Pegawai (OFFICER)");
  console.log("  creative1@jtm.gov.my  — Krew Kreatif (CREATIVE)");
  console.log("  trainee1@jtm.gov.my   — Pelatih (TRAINEE)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
